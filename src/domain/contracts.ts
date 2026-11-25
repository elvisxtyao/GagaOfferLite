export const MAX_SOURCE_LENGTH = 8_000
export const MAX_REQUIREMENTS = 8
export const MAX_TITLE_LENGTH = 150
export const MAX_DESCRIPTION_LENGTH = 2_000
export const MAX_NOTE_LENGTH = 2_000
export const MAX_DEADLINE_LENGTH = 300

export type ApplicationData = {
  name: string
  sourceUrl: string
  sourceText: string
  ownerId: string
}

export type RequirementData = {
  applicationId: string
  ownerId: string
  title: string
  description: string
  deadlineRaw: string
  sourceDeadlineRaw: string
  evidenceQuote: string
  reviewStatus: 'draft' | 'accepted'
  completed: boolean
  note: string
  targetDate: string
  /** Internal unique slot prevents concurrent extraction from duplicating rows. */
  extractionKey: string
}

export type ApplicationInput = Omit<ApplicationData, 'ownerId'>
export type RequirementEdit = Pick<RequirementData,
  'title' | 'description' | 'deadlineRaw' | 'reviewStatus' | 'completed' | 'note' | 'targetDate'>
export type ExtractedRequirement = {
  title: string
  description: string
  deadline_raw: string
  evidence_quote: string
}

export class InputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InputError'
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InputError('Please provide valid input fields.')
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string') throw new InputError(`${label} must be text.`)
  if (value.length > max) throw new InputError(`${label} must be ${max.toLocaleString('en-US')} characters or fewer.`)
  if (!allowEmpty && !value.trim()) throw new InputError(`${label} is required.`)
  return value
}

export function validateApplicationInput(value: unknown): ApplicationInput {
  const input = object(value)
  const name = text(input.name, 'Application name', MAX_TITLE_LENGTH).trim()
  const sourceUrl = text(input.sourceUrl, 'Source URL', 2_000).trim()
  let url: URL
  try { url = new URL(sourceUrl) } catch { throw new InputError('Enter a valid source URL beginning with https:// or http://.') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new InputError('Enter an http:// or https:// source URL without login details.')
  const sourceText = text(input.sourceText, 'Source text', MAX_SOURCE_LENGTH)
  return { name, sourceUrl, sourceText }
}

export function validateTargetDate(value: unknown): string {
  const targetDate = text(value, 'Personal target date', 10, true)
  if (!targetDate) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate))
    throw new InputError('Personal target date must use YYYY-MM-DD.')
  const parsed = new Date(`${targetDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== targetDate)
    throw new InputError('Enter a valid personal target date.')
  return targetDate
}

/** Validates a partial UI edit. Source evidence and ownership are never editable here. */
export function validateRequirementEdit(value: unknown): Partial<RequirementEdit> {
  const input = object(value)
  const output: Partial<RequirementEdit> = {}
  for (const key of Object.keys(input)) {
    switch (key) {
      case 'title': output.title = text(input[key], 'Title', MAX_TITLE_LENGTH).trim(); break
      case 'description': output.description = text(input[key], 'Description', MAX_DESCRIPTION_LENGTH).trim(); break
      case 'deadlineRaw': output.deadlineRaw = text(input[key], 'Deadline', MAX_DEADLINE_LENGTH, true); break
      case 'note': output.note = text(input[key], 'Note', MAX_NOTE_LENGTH, true); break
      case 'targetDate': output.targetDate = validateTargetDate(input[key]); break
      case 'reviewStatus':
        if (input[key] !== 'draft' && input[key] !== 'accepted') throw new InputError('Invalid review status.')
        output.reviewStatus = input[key]; break
      case 'completed':
        if (typeof input[key] !== 'boolean') throw new InputError('Completion status must be true or false.')
        output.completed = input[key]; break
      default: throw new InputError(`The field ${key} cannot be edited.`)
    }
  }
  return output
}

export function validateRecordId(value: unknown): string {
  const id = text(value, 'Application ID', 200)
  if (!/^[A-Za-z0-9_:-]+$/.test(id)) throw new InputError('Invalid application ID.')
  return id
}

function validateExtractedItem(value: unknown, sourceText: string): ExtractedRequirement {
  const input = object(value)
  const title = text(input.title, 'Title', MAX_TITLE_LENGTH).trim()
  const description = text(input.description, 'Description', MAX_DESCRIPTION_LENGTH).trim()
  const evidence_quote = text(input.evidence_quote, 'Source quote', MAX_SOURCE_LENGTH)
  if (!sourceText.includes(evidence_quote))
    throw new InputError('The source quote does not exactly match the saved source. Please retry or copy an exact quote manually.')
  const deadline_raw = input.deadline_raw === null || input.deadline_raw === undefined
    ? '' : text(input.deadline_raw, 'Source deadline', MAX_DEADLINE_LENGTH, true)
  if (deadline_raw && (!sourceText.includes(deadline_raw) || !evidence_quote.includes(deadline_raw)))
    throw new InputError('The source deadline must appear exactly in its source quote. Please include that date in the quote or leave the date empty.')
  return { title, description, deadline_raw, evidence_quote }
}

/** All results are validated before any Requirement is saved. */
export function parseExtractionResponse(content: unknown, sourceText: string): ExtractedRequirement[] {
  if (typeof content !== 'string' || content.length > 40_000)
    throw new InputError('The AI response was not valid JSON. Your source is saved; please retry or add a requirement manually.')
  let decoded: unknown
  try { decoded = JSON.parse(content) } catch {
    throw new InputError('The AI response was not valid JSON. Your source is saved; please retry or add a requirement manually.')
  }
  const input = object(decoded)
  if (!Array.isArray(input.requirements) || input.requirements.length > MAX_REQUIREMENTS)
    throw new InputError(`The AI response must contain at most ${MAX_REQUIREMENTS} requirements.`)
  return input.requirements.map(item => validateExtractedItem(item, sourceText))
}

export function validateManualRequirement(value: unknown, sourceText: string): ExtractedRequirement {
  const input = object(value)
  return validateExtractedItem({
    title: input.title,
    description: input.description,
    deadline_raw: input.deadlineRaw ?? '',
    evidence_quote: input.evidenceQuote,
  }, sourceText)
}
