import { describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createActions } from './index'
import type { ApplicationData } from '../domain/contracts'

const sourceText = 'Submit an essay by January 15, 2027.'
const application: ApplicationData = { ownerId: 'alice', name: 'Application', sourceUrl: 'https://example.org/apply', sourceText }
const modelResponse = JSON.stringify({ requirements: [{ title: 'Essay', description: 'Submit an essay.', deadline_raw: 'January 15, 2027', evidence_quote: sourceText }] })

function setup(ownerId = 'alice') {
  const rows: Array<{ recordId: string; data: Record<string, unknown> }> = []
  const create = vi.fn(async (_collection: string, data: Record<string, unknown>) => {
    const recordId = `record-${rows.length + 1}`
    rows.push({ recordId, data })
    return { success: true, data: { recordId } }
  })
  const get = vi.fn(async () => ({ success: true, data: { record: { recordId: 'app-1', data: { ...application, ownerId } } } }))
  const query = vi.fn(async () => ({ success: true, data: { records: rows, count: rows.length } }))
  const ctx: ActionContext<Env> = {
    userId: 'alice', params: { applicationId: 'app-1' }, callerJwt: 'test-only-caller-token', env: {} as Env,
    tools: { create, get, query } as unknown as ActionTools,
  }
  return { ctx, rows, create, get, query }
}

describe('authenticated application actions', () => {
  it('takes application ownership from the verified caller and waits for saving', async () => {
    const { ctx, create } = setup()
    ctx.params = { ...application, ownerId: 'mallory' }
    const result = await createActions().createApplication(ctx)
    expect(result).toEqual({ success: true, data: { applicationId: 'record-1' } })
    expect(create.mock.calls[0][1].ownerId).toBe('alice')
  })

  it('rejects cross-user extraction and manual insertion before model or writes', async () => {
    const { ctx, create } = setup('bob')
    const generate = vi.fn(async () => modelResponse)
    const actions = createActions(generate)
    const extracted = await actions.extractRequirements(ctx)
    const manual = await actions.addRequirement(ctx)
    expect(extracted.success).toBe(false)
    expect(manual.success).toBe(false)
    expect(generate).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('stores valid output as uncompleted drafts with immutable source data', async () => {
    const { ctx, rows } = setup()
    const actions = createActions(async () => modelResponse)
    expect(await actions.extractRequirements(ctx)).toEqual({ success: true, data: { count: 1 } })
    expect(rows[0].data).toMatchObject({ ownerId: 'alice', applicationId: 'app-1', reviewStatus: 'draft', completed: false, deadlineRaw: 'January 15, 2027', sourceDeadlineRaw: 'January 15, 2027', targetDate: '', note: '', evidenceQuote: sourceText })
    const again = await actions.extractRequirements(ctx)
    expect(again.success).toBe(false)
    expect(rows).toHaveLength(1)
  })

  it('validates the complete AI batch before persisting even the first valid item', async () => {
    const { ctx, create } = setup()
    const response = JSON.parse(modelResponse)
    response.requirements.push({ ...response.requirements[0], evidence_quote: 'Invented source' })
    const result = await createActions(async () => JSON.stringify(response)).extractRequirements(ctx)
    expect(result.success).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })

  it('retains application data on a model failure and permits retry', async () => {
    const { ctx, rows, create } = setup()
    const generate = vi.fn().mockRejectedValueOnce(new Error('model unavailable')).mockResolvedValueOnce(modelResponse)
    const actions = createActions(generate)
    expect((await actions.extractRequirements(ctx)).success).toBe(false)
    expect(create).not.toHaveBeenCalled()
    expect(rows).toEqual([])
    expect(await actions.extractRequirements(ctx)).toEqual({ success: true, data: { count: 1 } })
  })

  it('does not report success when storage refuses a requirement', async () => {
    const { ctx, create } = setup()
    create.mockImplementationOnce(async () => ({ success: false, error: 'write refused' }) as never)
    const result = await createActions(async () => modelResponse).extractRequirements(ctx)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('0 drafts saved')
  })

  it('prevents simultaneous model requests within the same worker instance', async () => {
    const { ctx } = setup()
    let resolveModel!: (value: string) => void
    const generate = vi.fn(() => new Promise<string>(resolve => { resolveModel = resolve }))
    const actions = createActions(generate)
    const first = actions.extractRequirements(ctx)
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1))
    const second = await actions.extractRequirements(ctx)
    expect(second.success).toBe(false)
    resolveModel(modelResponse)
    expect((await first).success).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('manual records stay draft and cannot claim the client-supplied owner', async () => {
    const { ctx, rows } = setup()
    ctx.params = { applicationId: 'app-1', ownerId: 'mallory', title: 'Essay', description: 'Submit an essay.', deadlineRaw: 'January 15, 2027', evidenceQuote: sourceText, reviewStatus: 'accepted' }
    expect(await createActions().addRequirement(ctx)).toEqual({ success: true, data: { requirementId: 'record-1' } })
    expect(rows[0].data.ownerId).toBe('alice')
    expect(rows[0].data.reviewStatus).toBe('draft')
  })

  it('fails closed for anonymous calls', async () => {
    const { ctx, get, create } = setup()
    ctx.userId = 'anon-visitor'
    const result = await createActions().extractRequirements(ctx)
    expect(result.success).toBe(false)
    expect(get).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
