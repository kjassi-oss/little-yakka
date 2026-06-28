'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BrandLogo from '@/components/BrandLogo'

const RAINBOW = 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

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
    <div className="min-h-screen flex flex-col items-center justify-start p-4 pt-10 bg-white">
      <div className="w-full max-w-xs">
        <BrandLogo className="w-full max-w-[280px] h-auto mx-auto block mb-3" fallbackSize={220}/>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4">
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
              <h2 className="text-base font-black text-gray-700 text-center mb-1">New password</h2>
              <p className="text-xs text-gray-400 text-center mb-3">Choose a new password for your account</p>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
                placeholder="New password" required/>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
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
