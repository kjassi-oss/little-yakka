'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const RAINBOW = 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // The recovery link puts a session in the URL; confirm we have one.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1500)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: RAINBOW }}>
      <div className="w-full max-w-xs">
        <h1 className="text-3xl font-black text-white text-center mb-1" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          New password
        </h1>
        <p className="text-white/80 text-center text-sm mb-5">Choose a new password for your account</p>

        <div className="bg-white rounded-3xl shadow-2xl p-5">
          {done ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">✅</div>
              <p className="font-bold text-gray-800">Password updated!</p>
              <p className="text-sm text-gray-500 mt-1">Taking you in…</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3 animate-spin">⏳</div>
              <p className="text-sm text-gray-500">Verifying your reset link…</p>
              <p className="text-xs text-gray-400 mt-2">If this hangs, request a new link.</p>
              <Link href="/forgot-password" className="inline-block mt-3 font-bold text-pink-500 text-sm">Request new link</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
                placeholder="New password" required/>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
                placeholder="Confirm password" required/>
              {error && <p className="text-red-500 text-xs bg-red-50 rounded-2xl p-2.5">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full text-white font-bold py-3 rounded-2xl shadow-md active:scale-95 transition disabled:opacity-60"
                style={{ background: RAINBOW }}>
                {loading ? 'Saving...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
