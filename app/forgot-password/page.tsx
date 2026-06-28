'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BrandLogo from '@/components/BrandLogo'

const RAINBOW = 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 pt-10 bg-white">
      <div className="w-full max-w-xs">
        <BrandLogo className="w-full max-w-[280px] h-auto mx-auto block mb-3" fallbackSize={220}/>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">📬</div>
              <p className="font-bold text-gray-800 mb-1">Check your email</p>
              <p className="text-sm text-gray-500">If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way.</p>
              <Link href="/login" className="inline-block mt-5 font-bold text-pink-500">← Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <h2 className="text-base font-black text-gray-700 text-center mb-1">Forgot password?</h2>
              <p className="text-xs text-gray-400 text-center mb-3">We'll email you a reset link</p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-gray-50"
                placeholder="Your email" required/>
              {error && <p className="text-red-500 text-xs bg-red-50 rounded-2xl p-2.5">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full text-white font-bold py-3 rounded-2xl shadow-md active:scale-95 transition disabled:opacity-60"
                style={{ background: RAINBOW }}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <p className="text-center text-xs text-gray-400">
                Remembered it?{' '}
                <Link href="/login" className="font-bold text-pink-500">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
