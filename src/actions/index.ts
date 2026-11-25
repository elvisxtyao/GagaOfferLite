import type { ActionContext, ActionHandler, ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  InputError, parseExtractionResponse, validateApplicationInput, validateManualRequirement,
  validateRecordId, type ApplicationData, type ExtractedRequirement, type RequirementData,
} from '../domain/contracts'
import { extractModelJson } from '../domain/model'
import { reserveExtraction } from '../domain/budget'

type Context = ActionContext<Env>
export type GenerateRequirements = (sourceText: string, context: Context) => Promise<string>

async function ownedApplication(ctx: Context): Promise<{ applicationId: string; application: ApplicationData }> {
  const applicationId = validateRecordId(ctx.params.applicationId)
  const got = await ctx.tools.get<ApplicationData>('applications', applicationId)
  if (!got.success || got.data.record.data.ownerId !== ctx.userId)
    throw new InputError('Application not found or unavailable to your account.')
  // Revalidate stored text before spending credits, even if the UI was bypassed.
  const application = got.data.record.data
  validateApplicationInput(application)
  return { applicationId, application }
}

function draft(item: ExtractedRequirement, applicationId: string, ownerId: string, extractionKey: string): RequirementData {
  return {
    applicationId, ownerId, extractionKey,
    title: item.title, description: item.description,
    deadlineRaw: item.deadline_raw, sourceDeadlineRaw: item.deadline_raw,
    evidenceQuote: item.evidence_quote,
    reviewStatus: 'draft', completed: false, note: '', targetDate: '',
  }
}

function guarded(handler: ActionHandler<Env>): ActionHandler<Env> {
  return async ctx => {
    if (!ctx.userId || ctx.userId.startsWith('anon-')) return { success: false, error: 'Please sign in to continue.' }
    try { return await handler(ctx) } catch (error) {
      return { success: false, error: error instanceof InputError ? error.message : 'The request could not be completed. Please check saved items and try again.' }
    }
  }
}

/** The injected function is only a unit-test seam at the external paid model boundary. */
export function createActions(
  generate: GenerateRequirements = async (sourceText, ctx) => { await reserveExtraction(ctx.env, ctx.userId); return extractModelJson(sourceText, ctx.env) },
): Record<'createApplication' | 'extractRequirements' | 'addRequirement', ActionHandler<Env>> {
  const pending = new Set<string>()
  return {
    createApplication: guarded(async ctx => {
      const input = validateApplicationInput(ctx.params)
      const saved = await ctx.tools.create<ApplicationData>('applications', { ...input, ownerId: ctx.userId })
      if (!saved.success) return { success: false, error: 'Your application could not be saved. Please try again.' }
      return { success: true, data: { applicationId: saved.data.recordId } }
    }),
    extractRequirements: guarded(async ctx => {
      const { applicationId, application } = await ownedApplication(ctx)
      const key = `${ctx.userId}:${applicationId}`
      if (pending.has(key)) return { success: false, error: 'Extraction is already running for this application. Please wait.' }
      pending.add(key)
      try {
        const existing = await ctx.tools.query<RequirementData>('requirements', { where: { applicationId, ownerId: ctx.userId }, limit: 1 })
        if (!existing.success) return { success: false, error: 'Could not check saved requirements. Please try again.' }
        if (existing.data.records.length)
          return { success: false, error: 'This application already has requirements. Review the saved items or add a requirement manually.' }
        const content = await generate(application.sourceText, ctx)
        const requirements = parseExtractionResponse(content, application.sourceText)
        let count = 0
        for (let index = 0; index < requirements.length; index++) {
          // The unique application/slot pair rejects a competing extraction.
          // Never upsert a deterministic row ID: that could overwrite accepted work.
          const saved = await ctx.tools.create<RequirementData>('requirements', draft(requirements[index], applicationId, ctx.userId, `ai:${index}`))
          if (!saved.success) return {
            success: false,
            error: `Not all requirements could be saved. ${count} draft${count === 1 ? '' : 's'} saved by this request; review the saved items and add anything missing manually. Your source is retained.`,
          }
          count++
        }
        return { success: true, data: { count } }
      } finally {
        pending.delete(key)
      }
    }),
    addRequirement: guarded(async ctx => {
      const { applicationId, application } = await ownedApplication(ctx)
      const item = validateManualRequirement(ctx.params, application.sourceText)
      const saved: ActionResult<{ recordId: string }> = await ctx.tools.create<RequirementData>(
        'requirements', draft(item, applicationId, ctx.userId, `manual:${crypto.randomUUID()}`),
      )
      if (!saved.success) return { success: false, error: 'Your requirement could not be saved. Please try again.' }
      return { success: true, data: { requirementId: saved.data.recordId } }
    }),
  }
}

export const actions: Record<string, ActionHandler<Env>> = createActions()

