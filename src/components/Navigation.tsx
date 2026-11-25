import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, signOut } from 'deepspace'
import { LogOut } from 'lucide-react'

export default function Navigation() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  const [showAuth, setShowAuth] = useState(false)
  return <header className="lite-nav" data-testid="app-navigation"><Link to="/home" className="lite-brand"><span className="brand-mark">g</span>GagaOffer<span className="brand-lite">lite</span></Link><div className="nav-account">{isSignedIn ? <><span className="nav-identity" data-testid="nav-user-name">{user?.name || 'Your workspace'}</span><span className="sr-only" data-testid="nav-user-email">{user?.email}</span><button className="text-button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={16} /><span>Sign out</span></button></> : <button className="lite-button secondary" data-testid="nav-sign-in-button" onClick={() => setShowAuth(true)}>Sign in</button>}</div>{showAuth && <AuthOverlay onClose={() => setShowAuth(false)} title="Sign in to GagaOfferLite" description="Your applications and progress, saved to your account." />}</header>
}


