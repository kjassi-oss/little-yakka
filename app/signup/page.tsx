'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BrandLogo from '@/components/BrandLogo'

const RAINBOW = 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
        <BrandLogo className="w-full max-w-[280px] h-auto mx-auto block mb-3" fallbackSize={220}/>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4 space-y-3">
          <h2 className="text-base font-black text-gray-700 text-center">Create your account</h2>

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
