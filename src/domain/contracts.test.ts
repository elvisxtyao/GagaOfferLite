import { describe, expect, it } from 'vitest'
import {
  MAX_SOURCE_LENGTH, parseExtractionResponse, validateApplicationInput,
  validateManualRequirement, validateRequirementEdit, validateTargetDate,
} from './contracts'

const source = 'Submit a 500-word essay by January 15, 2027. Two references are required.'
const requirement = {
  title: 'Submit an essay', description: 'Write a 500-word essay.',
  deadline_raw: 'January 15, 2027', evidence_quote: 'Submit a 500-word essay by January 15, 2027.',
}
const wrap = (items: unknown[]) => JSON.stringify({ requirements: items })

describe('source and extraction validation', () => {
  it('preserves exact source whitespace and validates source limits before AI', () => {
    const input = { name: ' Example ', sourceUrl: 'https://example.org/apply', sourceText: `  ${source}\n` }
    expect(validateApplicationInput(input)).toEqual({ ...input, name: 'Example' })
    expect(() => validateApplicationInput({ ...input, sourceText: ' ' })).toThrow('required')
    expect(() => validateApplicationInput({ ...input, sourceText: 'a'.repeat(MAX_SOURCE_LENGTH + 1) })).toThrow('8,000')
    expect(() => validateApplicationInput({ ...input, sourceUrl: 'javascript:alert(1)' })).toThrow('source URL')
    expect(() => validateApplicationInput({ ...input, sourceUrl: 'https://user:pass@example.org/' })).toThrow('login details')
  })

  it('accepts only source-supported quotes and dates', () => {
    expect(parseExtractionResponse(wrap([requirement]), source)).toEqual([requirement])
    expect(() => parseExtractionResponse(wrap([{ ...requirement, evidence_quote: 'Submit by February 1.' }]), source)).toThrow('exactly match')
    expect(() => parseExtractionResponse(wrap([{ ...requirement, deadline_raw: 'January 15, 2028' }]), source)).toThrow('source deadline')
    expect(() => parseExtractionResponse(wrap([{ ...requirement, evidence_quote: 'Two references are required.' }]), source)).toThrow('source deadline')
  })

  it('keeps unknown dates empty instead of inventing a date', () => {
    const item = { title: 'Prepare references', description: 'Provide two references.', deadline_raw: null, evidence_quote: 'Two references are required.' }
    expect(parseExtractionResponse(wrap([item]), source)[0].deadline_raw).toBe('')
    expect(parseExtractionResponse(wrap([]), source)).toEqual([])
  })

  it('rejects malformed JSON, malformed fields and more than eight results', () => {
    expect(() => parseExtractionResponse('```json\n{}\n```', source)).toThrow('valid JSON')
    expect(() => parseExtractionResponse(wrap(Array(9).fill(requirement)), source)).toThrow('at most 8')
    expect(() => parseExtractionResponse(wrap([{ ...requirement, title: 42 }]), source)).toThrow('must be text')
    expect(() => parseExtractionResponse(wrap([{ ...requirement, description: 'a'.repeat(2001) }]), source)).toThrow('2,000')
  })

  it('uses the same provenance check for a manually added requirement', () => {
    expect(validateManualRequirement({ title: 'Essay', description: 'Submit it.', deadlineRaw: 'January 15, 2027', evidenceQuote: requirement.evidence_quote }, source).deadline_raw).toBe('January 15, 2027')
    expect(() => validateManualRequirement({ title: 'Essay', description: 'Submit it.', evidenceQuote: 'invented' }, source)).toThrow('exactly match')
  })
})

describe('personal editing', () => {
  it('keeps personal dates independent and supports clearing notes', () => {
    expect(validateRequirementEdit({ targetDate: '2026-12-01', deadlineRaw: '', note: '', completed: true, reviewStatus: 'accepted' }))
      .toEqual({ targetDate: '2026-12-01', deadlineRaw: '', note: '', completed: true, reviewStatus: 'accepted' })
    expect(() => validateRequirementEdit({ evidenceQuote: 'changed' })).toThrow('cannot be edited')
    expect(() => validateRequirementEdit({ ownerId: 'another-user' })).toThrow('cannot be edited')
    expect(() => validateRequirementEdit({ note: 'x'.repeat(2001) })).toThrow('2,000')
  })

  it('rejects impossible dates and invalid states', () => {
    expect(validateTargetDate('2028-02-29')).toBe('2028-02-29')
    expect(() => validateTargetDate('2027-02-29')).toThrow('valid personal target date')
    expect(() => validateRequirementEdit({ completed: 'true' })).toThrow('true or false')
    expect(() => validateRequirementEdit({ reviewStatus: 'published' })).toThrow('Invalid review status')
  })
})
