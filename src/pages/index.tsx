import { Link } from 'react-router-dom'
import { ArrowRight, Check, FileText, Sparkles } from 'lucide-react'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

export default function Landing() {
  return <><Seo {...seo} path="/" /><header className="lite-nav"><Link to="/" className="lite-brand"><span className="brand-mark">g</span>GagaOffer<span className="brand-lite">lite</span></Link><Link to="/home" className="text-button">Open workspace <ArrowRight size={16} /></Link></header><main className="lite-container lite-welcome" data-testid="static-landing"><span className="eyebrow">A CALMER WAY TO APPLY</span><h1>Requirements in.<br />A clear plan out.</h1><p>Turn a page of application requirements into a personal checklist. Keep the source, review every item, and take the next step.</p><Link to="/home" className="lite-button">Start your checklist <ArrowRight size={18} /></Link><div className="landing-steps"><div><FileText size={22} /><strong>Paste your source</strong><span>One page of instructions and its link.</span></div><div><Sparkles size={22} /><strong>Review AI drafts</strong><span>Every draft comes with an exact source quote.</span></div><div><Check size={22} /><strong>Make progress</strong><span>Confirm, add notes, and check things off.</span></div></div><p className="muted small">Private to your account. Saved across visits. You make the final call.</p></main></>
}
