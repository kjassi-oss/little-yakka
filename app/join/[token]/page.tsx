'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const THEME = 'var(--theme-gradient)'
const DISPLAY = 'var(--font-display), system-ui, sans-serif'

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [invite, setInvite] = useState<{ family_id: string; invited_email: string; family_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'signup' | 'login'>('signup')

  useEffect(() => { loadInvite() }, [token])

  async function loadInvite() {
    const supabase = createClient()
    // Secure token lookup via a SECURITY DEFINER function — returns only the
    // single invite matching this token, so the table itself stays private.
    const { data, error } = await supabase.rpc('get_invitation', { invite_token: token })
    const row = Array.isArray(data) ? data[0] : data

    if (error || !row || row.used) {
      setError('This invite link is invalid or has already been used.')
    } else {
      setInvite({
        family_id: row.family_id,
        invited_email: row.invited_email,
        family_name: row.family_name || 'your family',
      })
      setEmail(row.invited_email)
    }
    setLoading(false)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    setSaving(true); setError(''); setNotice('')
    const supabase = createClient()

    // 1) Get a signed-in session (new account or existing)
    if (mode === 'signup') {
      const { data, error: signupError } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
      if (signupError) { setError(signupError.message); setSaving(false); return }
      if (!data.session) {
        // Email confirmation is on — no session yet, so we can't join now.
        setNotice('Almost there! Check your email and click the confirmation link, then come back to this invite link and tap "I Have An Account" to finish joining.')
        setSaving(false)
        return
      }
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) { setError(loginError.message); setSaving(false); return }
    }

    // 2) Join the family server-side (validates token, creates the guardian,
    //    marks the invite used) — surfaces a real error instead of failing silently.
    const { error: joinError } = await supabase.rpc('accept_invitation', {
      invite_token: token, guardian_name: name,
    })
    if (joinError) {
      setError(`Couldn't join the family: ${joinError.message}`)
      setSaving(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="pt-12 pb-3 flex justify-center">
        <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto"/>
      </div>

      <div className="flex-1 w-full max-w-sm mx-auto px-5 pb-12">
        {loading ? (
          <p className="text-center text-gray-400 mt-10">Checking your invite…</p>
        ) : error && !invite ? (
          <div className="text-center mt-10">
            <div className="text-5xl mb-4">😕</div>
            <p className="text-red-500 font-semibold">{error}</p>
            <button onClick={() => router.push('/login')}
              className="mt-6 text-sm font-bold text-gray-400 active:scale-95 transition">← Back to sign in</button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎉</div>
              <h1 className="text-3xl font-black mb-1" style={{ fontFamily: DISPLAY, background: THEME, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                You're invited!
              </h1>
              <p className="text-gray-500 text-sm">Join <span className="font-bold text-gray-700">{invite?.family_name}</span> on Little Yakka</p>
            </div>

            <div className="flex bg-gray-100 rounded-2xl p-1 mb-5">
              {(['signup', 'login'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(''); setNotice('') }}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${mode === m ? 'text-white shadow' : 'text-gray-400'}`}
                  style={mode === m ? { background: THEME } : {}}>
                  {m === 'signup' ? 'Create Account' : 'I Have An Account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleJoin} className="space-y-3">
              {mode === 'signup' && (
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-300 bg-gray-50"
                  placeholder="Your name" required/>
              )}
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-300 bg-gray-50"
                placeholder="Email" required/>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-300 bg-gray-50"
                placeholder="Password" required/>

              {error && <p className="text-red-500 text-sm bg-red-50 rounded-2xl p-3">{error}</p>}
              {notice && <p className="text-sky-700 text-sm bg-sky-50 rounded-2xl p-3">{notice}</p>}

              <button type="submit" disabled={saving}
                className="w-full text-white font-black py-3.5 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
                style={{ background: THEME }}>
                {saving ? 'Joining…' : 'Join Family 🎉'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
