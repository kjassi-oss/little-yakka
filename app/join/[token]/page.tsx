'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [invite, setInvite] = useState<{ family_id: string; invited_email: string; family_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'signup' | 'login'>('signup')

  useEffect(() => { loadInvite() }, [token])

  async function loadInvite() {
    const supabase = createClient()
    const { data } = await supabase
      .from('guardian_invitations')
      .select('family_id, invited_email, used, families(name)')
      .eq('token', token)
      .single()

    if (!data || data.used) {
      setError('This invite link is invalid or has already been used.')
    } else {
      setInvite({
        family_id: data.family_id,
        invited_email: data.invited_email,
        family_name: (data.families as any)?.name || 'your family',
      })
      setEmail(data.invited_email)
    }
    setLoading(false)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    setSaving(true); setError('')
    const supabase = createClient()

    if (mode === 'signup') {
      const { data, error: signupError } = await supabase.auth.signUp({ email, password })
      if (signupError) { setError(signupError.message); setSaving(false); return }
      if (data.user) await addGuardian(supabase, data.user.id, invite.family_id, name)
    } else {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) { setError(loginError.message); setSaving(false); return }
      if (data.user) await addGuardian(supabase, data.user.id, invite.family_id, name)
    }

    await supabase.from('guardian_invitations').update({ used: true }).eq('token', token)
    router.push('/dashboard')
  }

  async function addGuardian(supabase: any, userId: string, familyId: string, guardianName: string) {
    const { data: existing } = await supabase.from('guardians').select('id').eq('auth_user_id', userId).single()
    if (!existing) {
      await supabase.from('guardians').insert({ auth_user_id: userId, family_id: familyId, name: guardianName || email.split('@')[0] })
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-spin">🔗</div></div>

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, var(--theme-from, #7C3AED), var(--theme-to, #EC4899))' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo size={80} className="shadow-2xl mb-4"/>
          <h1 className="text-3xl font-black text-white">Little <span className="text-yellow-300">Yakka</span></h1>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6">
          {error ? (
            <div className="text-center">
              <div className="text-5xl mb-4">😕</div>
              <p className="text-red-500 font-semibold">{error}</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-xl font-bold text-gray-800">You're invited!</h2>
                <p className="text-gray-500 text-sm mt-1">Join <span className="font-bold text-gray-700">{invite?.family_name}</span> on Little Yakka</p>
              </div>

              <div className="flex bg-gray-100 rounded-2xl p-1 mb-5">
                {(['signup', 'login'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition capitalize ${mode === m ? 'bg-white shadow' : 'text-gray-400'}`}
                    style={mode === m ? { color: 'var(--theme-from)' } : {}}>
                    {m === 'signup' ? 'Create account' : 'I have an account'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleJoin} className="space-y-3">
                {mode === 'signup' && (
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                    placeholder="Your name" required/>
                )}
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                  placeholder="Email" required/>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                  placeholder="Password" required/>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" disabled={saving}
                  className="w-full text-white font-bold py-3.5 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, var(--theme-from, #7C3AED), var(--theme-to, #EC4899))' }}>
                  {saving ? 'Joining...' : 'Join family 🎉'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
