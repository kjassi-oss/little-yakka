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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--theme-from, #7C3AED), var(--theme-to, #EC4899))' }}>

      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <span className="absolute text-6xl opacity-10 top-10 left-8 rotate-[-15deg]">⭐</span>
        <span className="absolute text-4xl opacity-10 top-24 right-10 rotate-[20deg]">🌟</span>
        <span className="absolute text-5xl opacity-10 bottom-32 left-6 rotate-[10deg]">✨</span>
        <span className="absolute text-3xl opacity-10 bottom-20 right-8 rotate-[-10deg]">💫</span>
        <span className="absolute text-4xl opacity-10 top-1/2 left-4 rotate-[5deg]">⭐</span>
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo section */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={96} className="shadow-2xl mb-4"/>
          <h1 className="text-4xl font-black text-white tracking-tight">
            Little <span className="text-yellow-300">Yakka</span>
          </h1>
          <p className="text-white/75 mt-1 text-base">Welcome back! 👋</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-5">Sign in</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                placeholder="you@example.com" required/>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                placeholder="••••••••" required/>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 rounded-2xl p-3">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full text-white font-bold py-3.5 rounded-2xl shadow-md active:scale-95 transition disabled:opacity-60 text-base"
              style={{ background: 'linear-gradient(135deg, var(--theme-from, #7C3AED), var(--theme-to, #EC4899))' }}>
              {loading ? 'Signing in...' : 'Sign in ✓'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-5">
            New to Little Yakka?{' '}
            <Link href="/signup" className="font-bold" style={{ color: 'var(--theme-from, #7C3AED)' }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
