'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isNative, nativeOAuthSignIn } from '@/lib/nativeAuth'
import BrandLogo from '@/components/BrandLogo'

const RAINBOW = 'var(--theme-gradient)'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)

  async function handleGoogle() {
    setGoogleLoading(true); setError('')
    const supabase = createClient()
    if (isNative()) {
      const r = await nativeOAuthSignIn(supabase, 'google')
      if (r.error) { setError(r.error); setGoogleLoading(false) }
      return // the deep-link listener (NativeAuth) finishes sign-in
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleApple() {
    setAppleLoading(true); setError('')
    const supabase = createClient()
    if (isNative()) {
      const r = await nativeOAuthSignIn(supabase, 'apple')
      if (r.error) { setError(r.error); setAppleLoading(false) }
      return // the deep-link listener (NativeAuth) finishes sign-in
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setAppleLoading(false) }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      router.push('/setup')
      router.refresh()
    } else {
      setError('Please check your email and click the confirmation link, then come back to sign in.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 pt-10 bg-white">
      <div className="w-full max-w-xs">
        <BrandLogo className="w-full max-w-[300px] h-auto mx-auto block mb-3" fallbackSize={240}/>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4 space-y-3">
          <h2 className="text-base font-black text-gray-700 text-center">Create your account</h2>

          <button onClick={handleApple} disabled={appleLoading}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-2.5 font-semibold text-white text-sm bg-black hover:bg-gray-900 active:scale-95 transition disabled:opacity-60">
            {appleLoading ? (
              <span className="text-sm">Redirecting...</span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 12.04c-.03-2.85 2.33-4.22 2.44-4.29-1.33-1.95-3.4-2.21-4.13-2.24-1.76-.18-3.43 1.03-4.32 1.03-.89 0-2.26-1.01-3.72-.98-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.94 1.37 2.06 2.9 3.53 2.85 1.42-.06 1.95-.91 3.66-.91 1.71 0 2.19.91 3.69.88 1.53-.03 2.49-1.39 3.42-2.77 1.08-1.59 1.52-3.13 1.55-3.21-.03-.01-2.97-1.14-3-4.53zM14.28 3.78c.78-.95 1.31-2.27 1.16-3.58-1.13.05-2.49.75-3.3 1.7-.72.84-1.36 2.18-1.19 3.47 1.26.1 2.55-.64 3.33-1.59z"/>
                </svg>
                Continue with Apple
              </>
            )}
          </button>
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

          <form onSubmit={handleSignup} className="space-y-2.5">
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
              placeholder="Your name (Mum or Dad)" required/>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
              placeholder="Email" required/>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
              placeholder="Password (min. 6 characters)" minLength={6} required/>

            {error && <p className="text-red-500 text-xs bg-red-50 rounded-2xl p-2.5">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full text-white font-bold py-3 rounded-2xl shadow-md active:scale-95 transition disabled:opacity-60"
              style={{ background: RAINBOW }}>
              {loading ? 'Creating account...' : 'Create account ✓'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-pink-500">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
