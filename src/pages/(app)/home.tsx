import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AuthOverlay, useAuth, useMutations, useQuery } from 'deepspace'
import { ArrowRight, Check, CheckCircle2, ExternalLink, FileText, Plus, Sparkles } from 'lucide-react'
import { runAction } from '../../lib/actions'
import type { ApplicationData, RequirementData } from '../../domain/contracts'
import { RequirementCard } from '../../components/RequirementCard'

export default function HomePage() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  if (!isLoaded) return <div className="lite-container" role="status">Loading your workspace…</div>
  if (!isSignedIn) return <section className="lite-welcome lite-container">
    <span className="eyebrow">YOUR NEXT APPLICATION, ONE STEP AT A TIME</span>
    <h1>Requirements in.<br />A clear plan out.</h1>
    <p>Paste application requirements, review what AI finds, and keep a checklist that stays with you.</p>
    <button className="lite-button" onClick={() => setShowAuth(true)}>Sign in to start <ArrowRight size={18} /></button>
    <p className="muted">Your applications and notes are private to your account.</p>
    {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} title="Sign in to GagaOfferLite" description="Your applications and progress, saved to your account." />}
  </section>
  return <Workspace key={userId} />
}

function Workspace() {
  const applications = useQuery<ApplicationData>('applications', { orderBy: 'createdAt' })
  const requirements = useQuery<RequirementData>('requirements', { orderBy: 'createdAt' })
  const mutations = useMutations<RequirementData>('requirements')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('application') ?? ''
  const setSelectedId = (id: string) => setSearchParams(id ? { application: id } : {}, { replace: true })
  const [name, setName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<'review' | 'checklist'>('review')
  const [manual, setManual] = useState(false)
  const application = applications.records.find((r) => r.recordId === selectedId)
  const rows = requirements.records.filter((r) => r.data.applicationId === selectedId)
  const drafts = rows.filter((r) => r.data.reviewStatus === 'draft')
  const accepted = rows.filter((r) => r.data.reviewStatus === 'accepted')
  const completed = accepted.filter((r) => r.data.completed).length
  const pending = !!busy

  async function task(key: string, fn: () => Promise<void>) {
    setBusy(key); setError(''); setNotice('')
    try { await fn() } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Your input has been kept.')
    } finally { setBusy('') }
  }
  async function extract(applicationId: string) {
    const data = await runAction<{ count: number }>('extractRequirements', { applicationId })
    setTab('review')
    setNotice(data.count ? `${data.count} draft requirements saved. Review each one before adding it to your checklist.` : 'No requirements found. You can add a requirement manually.')
  }
  function create(event: FormEvent, withAI: boolean) {
    event.preventDefault()
    void task('create', async () => {
      const data = await runAction<{ applicationId: string }>('createApplication', { name, sourceUrl, sourceText })
      setSelectedId(data.applicationId)
      setNotice('Application saved.')
      if (withAI) await extract(data.applicationId)
    })
  }
  function newApplication() {
    setSelectedId(''); setName(''); setSourceUrl(''); setSourceText(''); setManual(false); setError(''); setNotice('')
  }
  return <div className="lite-container">
    <div className="workspace-heading"><div><span className="eyebrow">YOUR APPLICATION WORKSPACE</span><h1>Make room for your next step.</h1><p className="muted">From the original requirements to a checklist you control.</p></div><span className="private-pill">Private workspace</span></div>
    {error && <div className="lite-alert error" role="alert">{error}</div>}
    {notice && <div className="lite-alert success" role="status"><CheckCircle2 size={18} />{notice}</div>}
    <div className="workspace-grid">
      <aside className="source-column">
        <div className="project-switch"><label htmlFor="application-select">Application</label><select id="application-select" value={selectedId} disabled={pending} onChange={(e) => { setSelectedId(e.target.value); setManual(false); setError(''); setNotice('') }}><option value="">New application</option>{applications.records.map((r) => <option key={r.recordId} value={r.recordId}>{r.data.name}</option>)}</select><button className="icon-button" aria-label="New application" title="New application" onClick={newApplication} disabled={pending}><Plus size={19} /></button></div>
        <section className="lite-panel source-panel">
          <div className="section-kicker"><span className="step">1</span> SAVE YOUR SOURCE</div>
          {!selectedId ? <form onSubmit={(e) => create(e, true)}>
            <h2>Start with the requirements.</h2><p className="muted small">Paste one page of application instructions. The source link stays attached to your checklist.</p>
            <label htmlFor="application-name">Application name</label><input id="application-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required placeholder="e.g. UBC Computer Science MSc" disabled={pending} />
            <label htmlFor="source-url">Source URL</label><input id="source-url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url" maxLength={2000} required placeholder="https://university.edu/admissions" disabled={pending} />
            <label htmlFor="source-text">Application requirements</label><textarea id="source-text" value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={10} aria-describedby="source-limit" aria-invalid={sourceText.length > 8000} required placeholder="Paste the requirements from the source page here…" disabled={pending} />
            <div className="field-meta" id="source-limit"><span>One source · up to 8 requirements</span><span>{sourceText.length.toLocaleString()} / 8,000</span></div>
            {sourceText.length > 8000 && <p className="inline-error" role="alert">Keep the source to 8,000 characters or fewer. Your pasted text has been kept.</p>}<p className="privacy-note">Only paste application instructions. Do not include passwords or applicant personal information. AI extraction sends this text to OpenAI through DeepSpace.</p>
            <button className="lite-button full" disabled={pending || !mutations.ready || !sourceText.trim() || sourceText.length > 8000} type="submit"><Sparkles size={17} />{busy === 'create' ? 'Saving & extracting…' : 'Save & extract requirements'}</button>
            <button className="text-button full" type="button" disabled={pending || !mutations.ready || !sourceText.trim() || sourceText.length > 8000 || !name.trim() || !sourceUrl.trim()} onClick={(e) => create(e, false)}>Save source without AI</button>
          </form> : application ? <>
            <h2>{application.data.name}</h2><a className="source-link" href={application.data.sourceUrl} target="_blank" rel="noreferrer">View original source <ExternalLink size={14} /></a>
            <details className="source-text"><summary>Saved requirements text</summary><p>{application.data.sourceText}</p></details>
            <p className="muted small">This saved source stays attached to every requirement. Check the original website for changes.</p>
            {rows.length === 0 && <button className="lite-button full" disabled={pending || !mutations.ready} onClick={() => void task('extract', () => extract(selectedId))}><Sparkles size={17} />{busy === 'extract' ? 'Extracting requirements…' : 'Extract with AI'}</button>}
            <button className="text-button full" disabled={pending || !mutations.ready || rows.length >= 8} onClick={() => setManual((v) => !v)}><Plus size={16} />Add requirement manually</button>
            {rows.length >= 8 && <p className="muted small">This application has reached the 8-item limit.</p>}
          </> : <p role="status">{applications.status === 'loading' ? 'Loading saved application…' : 'This application is unavailable to your account. Choose another application or start a new one.'}</p>}
        </section>
        <div className="source-footnote"><FileText size={18} /><p>AI drafts are starting points. You review and confirm what belongs in your plan.</p></div>
      </aside>
      <section className="review-column">
        <div className="workspace-tabs" role="tablist" aria-label="Requirement view"><button role="tab" id="review-tab" aria-controls="requirements-panel" aria-selected={tab === 'review'} onClick={() => setTab('review')}>Review drafts <span>{drafts.length}</span></button><button role="tab" id="checklist-tab" aria-controls="requirements-panel" aria-selected={tab === 'checklist'} onClick={() => setTab('checklist')}>My checklist <span>{accepted.length}</span></button></div>
        <div className="review-heading"><div className="section-kicker"><span className="step">{tab === 'review' ? '2' : '3'}</span>{tab === 'review' ? 'REVIEW & CONFIRM' : 'TAKE THE NEXT STEP'}</div><h2>{tab === 'review' ? 'You make the final call.' : 'A little progress, every day.'}</h2><p className="muted small">{tab === 'review' ? 'Check each quote. Edit the wording and dates, then confirm.' : `${completed} of ${accepted.length} completed. Your progress and notes are saved to your account.`}</p></div>
        {manual && application && <ManualForm pending={pending} onCancel={() => setManual(false)} onSubmit={(data) => void task('manual', async () => { await runAction('addRequirement', { applicationId: selectedId, ...data }); setManual(false); setTab('review'); setNotice('Manual draft saved. Review and confirm it below.') })} />}
        <div role="tabpanel" id="requirements-panel" aria-labelledby={tab === 'review' ? 'review-tab' : 'checklist-tab'}>
          {requirements.status === 'loading' && selectedId ? <p role="status">Loading your requirements…</p> : (tab === 'review' ? drafts : accepted).map((r) => <RequirementCard key={r.recordId} data={r.data} sourceUrl={application?.data.sourceUrl ?? ''} disabled={pending || !mutations.ready} saving={busy === r.recordId} onSave={(patch) => task(r.recordId, async () => { await mutations.putConfirmed(r.recordId, patch); setNotice(patch.reviewStatus === 'accepted' ? 'Requirement confirmed. Find it in My checklist.' : 'Changes saved.') })} />)}
          {(tab === 'review' ? drafts : accepted).length === 0 && <div className="empty-panel"><div className="empty-icon">{tab === 'review' ? <FileText size={26} /> : <Check size={26} />}</div><h3>{tab === 'review' ? selectedId ? 'Ready for your requirements.' : 'Your plan starts with a source.' : 'Your confirmed items will live here.'}</h3><p>{tab === 'review' ? selectedId ? 'Extract a short list with AI, or add a requirement manually.' : 'Save the application requirements on the left. Each draft will include a quote from your text.' : 'Review and confirm a draft to turn it into an actionable checklist item.'}</p>{drafts.length > 0 && tab === 'checklist' && <button className="text-button" onClick={() => setTab('review')}>Review {drafts.length} drafts <ArrowRight size={16} /></button>}</div>}
        </div>
      </section>
    </div>
    <footer className="lite-footer">GagaOfferLite <span>Keep the source. Make the plan yours.</span></footer>
  </div>
}

function ManualForm({ pending, onCancel, onSubmit }: { pending: boolean; onCancel: () => void; onSubmit: (data: Record<string, string>) => void }) {
  return <form className="lite-panel manual-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit(Object.fromEntries([...data].map(([key, value]) => [key, String(value)]))) }}>
    <h3>Add a requirement</h3><p className="muted small">Paste an exact supporting quote from your saved source.</p>
    <label htmlFor="manual-title">Title</label><input id="manual-title" name="title" maxLength={150} required disabled={pending} />
    <label htmlFor="manual-description">Description</label><textarea id="manual-description" name="description" maxLength={2000} required disabled={pending} rows={2} />
    <label htmlFor="manual-deadline">Source date text (optional)</label><input id="manual-deadline" name="deadlineRaw" maxLength={300} disabled={pending} placeholder="Copy from the source; leave empty if unstated" />
    <label htmlFor="manual-evidence">Exact source quote</label><textarea id="manual-evidence" name="evidenceQuote" maxLength={2000} rows={3} required disabled={pending} />
    <div className="card-actions"><button className="lite-button" disabled={pending} type="submit">Save draft</button><button className="text-button" disabled={pending} type="button" onClick={onCancel}>Cancel</button></div>
  </form>
}





