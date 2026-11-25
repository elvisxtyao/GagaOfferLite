import { test, expect, pickTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

const accountOptions = { label: 'gagaofferlite-acceptance' }
const sourceText = [
  'Synthetic admissions requirements for testing only.',
  'Submit a 500-word personal statement by January 15, 2027.',
  'Upload an academic transcript by February 1, 2027.',
  'Provide two academic references. No deadline is specified for references.',
].join('\n')
const sourceUrl = 'https://example.org/synthetic-admissions'
const scopeId = `app:${process.env.LIVE_APP_ID}`
type Row = { recordId: string; data: Record<string, unknown> }
type ActionReply = { status: number; body: { success?: boolean; data?: Record<string, unknown>; error?: string } }
type Probe = {
  operation: 'query' | 'put'
  collection: string
  where?: Record<string, unknown>
  recordId?: string
  data?: Record<string, unknown>
}

/** Session tokens never leave the browser evaluation or enter logs/attachments. */
async function action(page: Page, name: string, params: Record<string, unknown>): Promise<ActionReply> {
  return page.evaluate(async ({ name, params }) => {
    const tokenResponse = await fetch('/api/auth/token', { method: 'POST' })
    if (!tokenResponse.ok) throw new Error('Could not obtain the current test session.')
    const session = await tokenResponse.json() as { token?: string }
    if (!session.token) throw new Error('Test session did not provide a token.')
    const response = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(params),
    })
    return { status: response.status, body: await response.json() }
  }, { name, params })
}

/** Probes real RecordRoom RBAC, bypassing UI filtering and SDK mutation helpers. */
async function records(page: Page, probe: Probe): Promise<{ role: string; records?: Row[]; success?: boolean; error?: string }> {
  return page.evaluate(async ({ probe, scopeId }) => {
    const tokenResponse = await fetch('/api/auth/token', { method: 'POST' })
    if (!tokenResponse.ok) throw new Error('Could not obtain the current test session.')
    const { token } = await tokenResponse.json() as { token?: string }
    if (!token) throw new Error('Test session did not provide a token.')
    return new Promise<{ role: string; records?: Row[]; success?: boolean; error?: string }>((resolve, reject) => {
      const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws/${encodeURIComponent(scopeId)}?token=${encodeURIComponent(token)}`)
      const requestId = `lite-probe-${crypto.randomUUID()}`
      let role = ''
      const timer = setTimeout(() => { ws.close(); reject(new Error('Records probe timed out.')) }, 20_000)
      const finish = (result: { role: string; records?: Row[]; success?: boolean; error?: string }) => {
        clearTimeout(timer); ws.close(); resolve(result)
      }
      ws.onerror = () => { clearTimeout(timer); ws.close(); reject(new Error('Records probe could not connect.')) }
      ws.onmessage = event => {
        if (typeof event.data !== 'string') return
        let message: { type: string; payload: Record<string, unknown> }
        try { message = JSON.parse(event.data) } catch { return }
        if (message.type === 'user.info') {
          role = String(message.payload.role)
          if (probe.operation === 'query') ws.send(JSON.stringify({
            type: 'core.subscribe', payload: { subscriptionId: requestId, query: { collection: probe.collection, where: probe.where } },
          }))
          else ws.send(JSON.stringify({
            type: 'core.put', payload: { collection: probe.collection, recordId: probe.recordId, data: probe.data, requestId },
          }))
        }
        if (message.type === 'core.query_result' && message.payload.subscriptionId === requestId)
          finish({ role, records: message.payload.records as Row[] })
        if (message.type === 'records.ack' && message.payload.requestId === requestId)
          finish({ role, success: message.payload.success === true, error: typeof message.payload.error === 'string' ? message.payload.error : undefined })
        if (message.type === 'core.error' && message.payload.subscriptionId === requestId)
          finish({ role, success: false, error: 'The server refused the records query.' })
      }
    })
  }, { probe, scopeId })
}

async function openWorkspace(page: Page) {
  await page.goto('/home')
  await expect(page.getByLabel('Application', { exact: true })).toBeVisible()
  await expect(page.getByTestId('nav-user-email')).toHaveText(/@/)
}

async function selectApplication(page: Page, applicationId: string) {
  await expect(page.locator(`#application-select option[value="${applicationId}"]`)).toHaveCount(1)
  await page.locator('#application-select').selectOption(applicationId)
}

// Synthetic data remains isolated in the dedicated test accounts: deletion is
// intentionally absent from the Lite product. Never clear unrelated records.
test('anonymous API calls cannot write records or reach paid integrations', async ({ request }) => {
  const blockedAction = await request.post('/api/actions/createApplication', { data: { name: 'Denied', sourceUrl, sourceText } })
  expect(blockedAction.status()).toBe(401)
  const blockedModel = await request.post('/api/integrations/openai/chat-completion', { data: {} })
  expect(blockedModel.status()).toBe(404)
  const stamp = await request.get('/.well-known/deepspace/release.json')
  expect(stamp.status()).toBe(200)
  if (process.env.LIVE_EXPECTED_BUILD_STAMP) expect(await stamp.text()).toContain(process.env.LIVE_EXPECTED_BUILD_STAMP)
})

test('real AI, review, confirmed checklist, refresh and two-user isolation', async ({ users }, testInfo) => {
  const [a, b] = await users(2, accountOptions)
  await Promise.all([openWorkspace(a.page), openWorkspace(b.page)])
  const name = `__test-${Date.now()}__ synthetic application`
  let applicationId = ''
  let requirementId = ''
  let originalQuote = ''
  let originalDate = ''
  let initialCount = 0
  const editedTitle = 'Prepare the personal statement'
  const editedDescription = 'Write and proofread the 500-word personal statement.'
  const editedDate = 'January 15, 2027 (reviewed)'
  const note = 'Synthetic note: final proofread complete.'

  await test.step('server rejects empty and oversized sources without creating records', async () => {
    for (const badSource of ['', 'x'.repeat(8_001)]) {
      const reply = await action(a.page, 'createApplication', { name: 'Invalid synthetic application', sourceUrl, sourceText: badSource })
      expect(reply.body.success).toBe(false)
      expect(reply.body.error).toMatch(/required|8,000/)
    }
    const found = await records(a.page, { operation: 'query', collection: 'applications', where: { name: 'Invalid synthetic application' } })
    expect(found.role).toBe('member')
    expect(found.records).toHaveLength(0)
  })

  await test.step('save input and perform one real model extraction, or resume its saved result', async () => {
    const reuseName = process.env.LIVE_REUSE_APPLICATION_NAME
    if (reuseName) {
      const existing = await records(a.page, { operation: 'query', collection: 'applications', where: { name: reuseName } })
      expect(existing.records).toHaveLength(1)
      expect(existing.records![0].data.sourceText).toBe(sourceText)
      applicationId = existing.records![0].recordId
      await selectApplication(a.page, applicationId)
    } else {
      await a.page.getByRole('button', { name: 'New application', exact: true }).click()
      await a.page.getByLabel('Application name').fill(name)
      await a.page.getByLabel('Source URL').fill(sourceUrl)
      await a.page.getByLabel('Application requirements').fill(sourceText)
      const created = a.page.waitForResponse(response => response.url().endsWith('/api/actions/createApplication') && response.request().method() === 'POST')
      const extracted = a.page.waitForResponse(response => response.url().endsWith('/api/actions/extractRequirements') && response.request().method() === 'POST', { timeout: 65_000 })
      await a.page.getByRole('button', { name: 'Save & extract requirements' }).click()
      const createReply = await (await created).json()
      expect(createReply.success).toBe(true)
      applicationId = createReply.data.applicationId
      const extractReply = await (await extracted).json()
      expect(extractReply.success, extractReply.error ?? 'Real model extraction must succeed.').toBe(true)
      expect(extractReply.data.count).toBe(3)
      await expect(a.page.locator('article.requirement-card')).toHaveCount(3)
    }
    const saved = await records(a.page, { operation: 'query', collection: 'requirements', where: { applicationId } })
    expect(saved.role).toBe('member')
    expect(saved.records).toHaveLength(3)
    initialCount = saved.records!.length
    for (const row of saved.records!) {
      expect(sourceText).toContain(String(row.data.evidenceQuote))
      if (!process.env.LIVE_REUSE_APPLICATION_NAME) expect(row.data.reviewStatus).toBe('draft')
      if (!process.env.LIVE_REUSE_APPLICATION_NAME) expect(Boolean(row.data.completed)).toBe(false)
      if (row.data.sourceDeadlineRaw) expect(String(row.data.evidenceQuote)).toContain(String(row.data.sourceDeadlineRaw))
    }
    const references = saved.records!.find(row => /references/i.test(String(row.data.evidenceQuote)))!
    expect(references.data.sourceDeadlineRaw).toBe('')
    const statement = saved.records!.find(row => /personal statement/i.test(String(row.data.evidenceQuote)))!
    requirementId = statement.recordId
    originalQuote = String(statement.data.evidenceQuote)
    originalDate = String(statement.data.sourceDeadlineRaw)
    if (reuseName) {
      const reset = await records(a.page, { operation: 'put', collection: 'requirements', recordId: requirementId, data: { reviewStatus: 'draft', completed: false } })
      expect(reset.success).toBe(true)
      await a.page.getByRole('tab', { name: /Review drafts/ }).click()
    }
  })

  await test.step('edit title, description and dates, then confirm the same record twice', async () => {
    const card = a.page.locator('article.requirement-card').filter({ hasText: originalQuote })
    await card.getByLabel('Title', { exact: true }).fill(editedTitle)
    await card.getByLabel('Requirement', { exact: true }).fill(editedDescription)
    await card.getByLabel('Reviewed source date').fill(editedDate)
    await card.getByLabel('My target date').fill('2027-01-10')
    await card.getByRole('button', { name: 'Confirm requirement' }).click()
    await expect(a.page.getByRole('status')).toContainText('Requirement confirmed')
    const again = await records(a.page, { operation: 'put', collection: 'requirements', recordId: requirementId, data: { reviewStatus: 'accepted' } })
    expect(again.success).toBe(true)
    const saved = await records(a.page, { operation: 'query', collection: 'requirements', where: { applicationId } })
    expect(saved.records).toHaveLength(initialCount)
    const row = saved.records!.find(item => item.recordId === requirementId)!
    expect(row.data).toMatchObject({ title: editedTitle, description: editedDescription, deadlineRaw: editedDate, sourceDeadlineRaw: originalDate, evidenceQuote: originalQuote, reviewStatus: 'accepted', targetDate: '2027-01-10' })
  })

  await test.step('complete, reopen, save a note and preserve everything after refresh', async () => {
    await a.page.getByRole('tab', { name: /My checklist/ }).click()
    const card = a.page.locator('article.requirement-card').filter({ hasText: editedTitle })
    await card.getByRole('checkbox').click()
    await expect(card.locator('.status-label')).toHaveText('Completed')
    await card.getByRole('checkbox').click()
    await expect(card.locator('.status-label')).toHaveText('Confirmed')
    await card.getByLabel('Personal notes').fill(note)
    await card.getByRole('button', { name: 'Save changes' }).click()
    await expect(card.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await card.getByRole('checkbox').click()
    await expect(card.locator('.status-label')).toHaveText('Completed')
    await a.page.reload()
    await selectApplication(a.page, applicationId)
    await a.page.getByRole('tab', { name: /My checklist/ }).click()
    const reloaded = a.page.locator('article.requirement-card').filter({ hasText: editedTitle })
    await expect(reloaded.getByRole('checkbox')).toBeChecked()
    await expect(reloaded.getByLabel('Personal notes')).toHaveValue(note)
    await expect(reloaded).toContainText(editedDescription)
    await expect(reloaded).toContainText(editedDate)
    await expect(reloaded).toContainText('2027-01-10')
    await expect(reloaded).toContainText(`Original date: ${originalDate}`)
  })

  await test.step('ordinary B cannot read or mutate A records or invoke A extraction', async () => {
    for (const collection of ['applications', 'requirements']) {
      const read = await records(b.page, { operation: 'query', collection, where: collection === 'applications' ? { recordId: applicationId } : { applicationId } })
      expect(read.role).toBe('member')
      expect(read.records).toEqual([])
    }
    const forged = await records(b.page, { operation: 'put', collection: 'requirements', recordId: requirementId, data: { note: 'forged cross-user note' } })
    expect(forged.success).toBe(false)
    const otherExtraction = await action(b.page, 'extractRequirements', { applicationId })
    expect(otherExtraction.body.success).toBe(false)
    expect(otherExtraction.body.error).toMatch(/not found|unavailable/)
    await expect(b.page.locator('#application-select')).not.toContainText(process.env.LIVE_REUSE_APPLICATION_NAME ?? name)
  })

  await test.step('even the owner cannot rewrite saved evidence or application source', async () => {
    for (const data of [{ evidenceQuote: 'forged quote' }, { sourceDeadlineRaw: 'January 1, 1900' }, { ownerId: 'forged-owner' }, { applicationId: 'forged-parent' }]) {
      const result = await records(a.page, { operation: 'put', collection: 'requirements', recordId: requirementId, data })
      expect(result.success).toBe(false)
    }
    const sourceChange = await records(a.page, { operation: 'put', collection: 'applications', recordId: applicationId, data: { sourceText: 'forged source' } })
    expect(sourceChange.success).toBe(false)
    const saved = await records(a.page, { operation: 'query', collection: 'requirements', where: { applicationId } })
    expect(saved.records!.find(row => row.recordId === requirementId)!.data).toMatchObject({ note, evidenceQuote: originalQuote, sourceDeadlineRaw: originalDate })
  })
  await test.step('capture synthetic desktop and mobile views for visual QA', async () => {
    await a.page.setViewportSize({ width: 1440, height: 1100 })
    await a.page.screenshot({ path: testInfo.outputPath('lite-desktop.png'), fullPage: true })
    await a.page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => a.page.evaluate(() => {
      const main = document.querySelector('main')!
      return {
        document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        main: main.scrollWidth <= main.clientWidth,
      }
    }), { message: 'The mobile document and main content must not overflow horizontally.' }).toEqual({ document: true, main: true })
    await a.page.locator('main').evaluate(element => { element.scrollTop = 0 })
    await a.page.screenshot({ path: testInfo.outputPath('lite-mobile-source.png'), fullPage: true })
    await a.page.locator('article.requirement-card').filter({ hasText: editedTitle }).scrollIntoViewIfNeeded()
    await a.page.screenshot({ path: testInfo.outputPath('lite-mobile-checklist.png'), fullPage: true })
  })
  console.info(`LIVE ACCEPTANCE: ${process.env.LIVE_REUSE_APPLICATION_NAME ? 'reused the previously verified real AI result' : 'real AI returned 3 verified drafts'}; review, idempotent confirmation, completion, reopen, note, refresh, source immutability and two-member isolation passed.`)
})

test('a controlled AI outage preserves the source and allows a manual draft', async ({ users }) => {
  const [a] = await users(1, accountOptions)
  await openWorkspace(a.page)
  await a.page.getByRole('button', { name: 'New application', exact: true }).click()
  await a.page.route('**/api/actions/extractRequirements', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Controlled AI outage for acceptance testing. Your source is saved.' }),
  }))
  const name = `__test-${Date.now()}__ controlled model outage`
  await a.page.getByLabel('Application name').fill(name)
  await a.page.getByLabel('Source URL').fill(sourceUrl)
  await a.page.getByLabel('Application requirements').fill(sourceText)
  const created = a.page.waitForResponse(response => response.url().endsWith('/api/actions/createApplication'))
  await a.page.getByRole('button', { name: 'Save & extract requirements' }).click()
  const createReply = await (await created).json()
  expect(createReply.success).toBe(true)
  const applicationId = createReply.data.applicationId as string
  await expect(a.page.getByRole('alert')).toContainText('Controlled AI outage')
  await a.page.reload()
  await selectApplication(a.page, applicationId)
  await a.page.getByText('Saved requirements text', { exact: true }).click()
  await expect(a.page.locator('details.source-text')).toContainText(sourceText)
  await expect(a.page.locator('article.requirement-card')).toHaveCount(0)
  await a.page.getByRole('button', { name: 'Add requirement manually' }).click()
  await a.page.getByLabel('Title', { exact: true }).fill('Manual personal statement')
  await a.page.getByLabel('Description', { exact: true }).fill('Submit a 500-word personal statement.')
  await a.page.getByLabel('Source date text (optional)').fill('January 15, 2027')
  await a.page.getByLabel('Exact source quote').fill('Submit a 500-word personal statement by January 15, 2027.')
  await a.page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(a.page.locator('article.requirement-card')).toHaveCount(1)
  await expect(a.page.locator('article.requirement-card .status-label')).toHaveText('Needs your review')
  console.info('LIVE ACCEPTANCE: controlled external-model outage preserved the source; manual draft saved successfully. This was a simulated failure, not a real provider outage.')
})

test('same-page sign-out and sign-in cannot expose the previous account cache', async ({ users }) => {
  const [a, b] = await users(2, accountOptions)
  await openWorkspace(a.page)
  const applications = await records(a.page, { operation: 'query', collection: 'applications' })
  const owned = applications.records!.find(row => String(row.data.name).endsWith('__ synthetic application'))
  expect(owned, 'The earlier synthetic workflow must have a saved application.').toBeTruthy()
  const privateName = String(owned!.data.name)
  await selectApplication(a.page, owned!.recordId)
  await expect(a.page.getByRole('heading', { name: privateName })).toBeVisible()
  const documentMarker = `same-document-${Date.now()}`
  await a.page.evaluate(marker => { (window as unknown as Record<string, unknown>).__liteDocumentMarker = marker }, documentMarker)
  await a.page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(a.page.getByRole('button', { name: 'Sign in to start' })).toBeVisible()
  await expect(a.page.locator('#application-select')).toHaveCount(0)

  await a.page.evaluate(name => {
    const state = window as unknown as Record<string, unknown>
    state.__liteObservedPrivateName = false
    const observe = () => {
      if (document.body.textContent?.includes(name)) state.__liteObservedPrivateName = true
    }
    const observer = new MutationObserver(observe)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    state.__liteObserver = observer
    observe()
  }, privateName)

  // The SDK's registry loader keeps account secrets in process memory. Avoid
  // locator.fill(password): failed locator logs can include the fill argument.
  const accountB = pickTestAccounts(2, accountOptions)[1]
  expect(accountB.email).toBe(b.email)
  await a.page.getByRole('button', { name: 'Sign in to start' }).click()
  const overlay = a.page.getByTestId('auth-overlay')
  await overlay.getByTestId('auth-email-toggle').click()
  await a.page.evaluate(({ email, password }) => {
    const overlay = document.querySelector('[data-testid="auth-overlay"]')
    const emailInput = overlay?.querySelector<HTMLInputElement>('input[type="email"]')
    const passwordInput = overlay?.querySelector<HTMLInputElement>('input[type="password"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (!emailInput || !passwordInput || !setter) throw new Error('Test sign-in form is unavailable.')
    setter.call(emailInput, email)
    emailInput.dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(passwordInput, password)
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
  }, { email: accountB.email, password: accountB.password })
  await overlay.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(a.page.getByTestId('nav-user-email')).toHaveText(b.email)
  await expect(a.page.locator('#application-select')).toBeVisible()
  await expect(a.page.locator('#application-select')).not.toContainText(privateName)
  const observed = await a.page.evaluate(() => {
    const state = window as unknown as Record<string, unknown>
    ;(state.__liteObserver as MutationObserver).disconnect()
    return { leaked: state.__liteObservedPrivateName, documentMarker: state.__liteDocumentMarker }
  })
  expect(observed.documentMarker).toBe(documentMarker)
  expect(observed.leaked).toBe(false)
  console.info('LIVE ACCEPTANCE: same browser page switched from A to B without navigation or a previous-account record appearing in the DOM.')
})
