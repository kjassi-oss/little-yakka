'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  async function handleGoogle() {
    setGoogleLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  const RAINBOW = 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)'

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 pt-20 relative overflow-hidden"
      style={{ background: RAINBOW }}>

      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {['⭐','🌟','✨','💫','⭐','🌟'].map((s, i) => (
          <span key={i} className="absolute text-4xl opacity-15"
            style={{ top: `${6 + i * 15}%`, left: i % 2 === 0 ? `${4 + i * 3}%` : 'auto', right: i % 2 !== 0 ? `${4 + i * 2}%` : 'auto', transform: `rotate(${i % 2 === 0 ? -15 : 20}deg)` }}>
            {s}
          </span>
        ))}
      </div>

      <div className="w-full max-w-xs relative">
        {/* Rainbow logo, same width as the sign-in card below */}
        <div className="flex flex-col items-center mb-5">
          <Logo size={240} rainbow className="shadow-2xl mb-3 w-[78%] h-auto"/>
          <div className="w-fit mx-auto text-center">
            <h1 className="text-5xl font-black text-white tracking-tight"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              Little Yakka
            </h1>
            {/* Tagline: same display font, all caps, justified to the wordmark's width */}
            <p className="block w-full text-white uppercase font-bold mt-1.5 text-[10px] leading-tight"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', textAlign: 'justify', textAlignLast: 'justify' }}>
              Making chores fun leading to positive lifelong habits
            </p>
          </div>
        </div>

        {/* Compact sign-in card */}
        <div className="bg-white rounded-3xl shadow-2xl p-4 space-y-2.5">
          <button onClick={handleGoogle} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 border-2 border-gray-200 rounded-2xl py-2.5 font-semibold text-gray-700 text-sm hover:bg-gray-50 active:scale-95 transition disabled:opacity-60">
            {googleLoading ? (
              <span className="text-sm">Redirecting...</span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200"/>
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200"/>
          </div>

          <form onSubmit={handleLogin} className="space-y-2.5">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
              placeholder="Email" required/>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
              placeholder="Password" required/>

            <div className="text-right -mt-0.5">
              <Link href="/forgot-password" className="text-xs font-semibold text-pink-500">Forgot password?</Link>
            </div>

            {error && <p className="text-red-500 text-xs bg-red-50 rounded-2xl p-2.5">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full text-white font-bold py-3 rounded-2xl shadow-md active:scale-95 transition disabled:opacity-60"
              style={{ background: RAINBOW }}>
              {loading ? 'Signing in...' : 'Sign in ✓'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400">
            New here?{' '}
            <Link href="/signup" className="font-bold text-pink-500">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
