import { useState } from 'react'
import { Check, CheckCircle2, ExternalLink } from 'lucide-react'
import type { RequirementData } from '../domain/contracts'
import { validateRequirementEdit } from '../domain/contracts'

export function RequirementCard({ data, sourceUrl, disabled, saving, onSave }: {
  data: RequirementData; sourceUrl: string; disabled: boolean; saving: boolean;
  onSave: (patch: Partial<RequirementData>) => Promise<void>;
}) {
  const [title, setTitle] = useState(data.title)
  const [description, setDescription] = useState(data.description)
  const [deadlineRaw, setDeadlineRaw] = useState(data.deadlineRaw)
  const [targetDate, setTargetDate] = useState(data.targetDate)
  const [note, setNote] = useState(data.note)
  const [error, setError] = useState('')
  const accepted = data.reviewStatus === 'accepted'
  const prefix = `req-${data.extractionKey}`
  async function save(confirm: boolean) {
    setError('')
    try {
      const patch = validateRequirementEdit({ title, description, deadlineRaw, targetDate, note, ...(confirm ? { reviewStatus: 'accepted' } : {}) })
      await onSave(patch)
    } catch (err) { setError(err instanceof Error ? err.message : 'Please check these fields.') }
  }
  const fields = <>
    <label htmlFor={`${prefix}-title`}>Title</label><input id={`${prefix}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} disabled={disabled} />
    <label htmlFor={`${prefix}-description`}>Requirement</label><textarea id={`${prefix}-description`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} disabled={disabled} />
    <div className="date-fields"><div><label htmlFor={`${prefix}-deadline`}>Reviewed source date</label><input id={`${prefix}-deadline`} value={deadlineRaw} onChange={(e) => setDeadlineRaw(e.target.value)} maxLength={300} placeholder="Not stated" disabled={disabled} /></div><div><label htmlFor={`${prefix}-target`}>My target date</label><input id={`${prefix}-target`} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={disabled} /></div></div>
  </>
  return <article className={`requirement-card ${data.completed ? 'is-complete' : ''}`}>
    <div className="requirement-topline"><span className={`status-label ${accepted ? 'accepted' : ''}`}>{accepted ? data.completed ? 'Completed' : 'Confirmed' : 'Needs your review'}</span>{accepted && <label className="completion-toggle"><input type="checkbox" checked={!!data.completed} disabled={disabled} onChange={(event) => void onSave({ completed: event.target.checked })} />{data.completed ? 'Reopen' : 'Mark complete'}</label>}</div>
    {accepted ? <><h3 className="checklist-title">{data.completed && <CheckCircle2 size={21} />}{data.title}</h3><p className="requirement-description">{data.description}</p><details className="edit-details"><summary>Edit wording & dates</summary>{fields}</details></> : fields}
    <blockquote><span className="quote-label">FROM YOUR SAVED SOURCE</span><p>“{data.evidenceQuote}”</p><div className="quote-footer"><span>Original date: {data.sourceDeadlineRaw || 'Not stated'}</span><a href={sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={12} /></a></div></blockquote>
    {accepted && <><div className="date-summary"><span>Source date <strong>{data.deadlineRaw || 'Not stated'}</strong></span><span>My target <strong>{data.targetDate || 'Not set'}</strong></span></div><label htmlFor={`${prefix}-note`}>Personal notes</label><textarea id={`${prefix}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} placeholder="What is your next step?" disabled={disabled} /></>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="card-actions"><button className={accepted ? 'lite-button secondary' : 'text-button'} disabled={disabled} onClick={() => void save(false)}>{saving ? 'Saving…' : accepted ? 'Save changes' : 'Save draft'}</button>{!accepted && <button className="lite-button" disabled={disabled} onClick={() => void save(true)}><Check size={16} />Confirm requirement</button>}</div>
  </article>
}

