'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const AVATARS = ['🐨', '🦁', '🐯', '🦊', '🐻', '🐼', '🐸', '🦄', '🐙', '🦋', '🐬', '🦉']
const COLOURS = ['#FF6B6B', '#FF9F43', '#FFC312', '#A3CB38', '#12CBC4', '#1289A7', '#9B59B6', '#FDA7DF']

interface Child {
  name: string
  avatar: string
  colour: string
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [familyName, setFamilyName] = useState('')
  const [parentPin, setParentPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [children, setChildren] = useState<Child[]>([])
  const [currentChild, setCurrentChild] = useState<Child>({ name: '', avatar: '🐨', colour: '#FF6B6B' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function addChild() {
    if (!currentChild.name.trim()) return
    setChildren([...children, { ...currentChild }])
    setCurrentChild({ name: '', avatar: '🐨', colour: '#FF6B6B' })
  }

  function removeChild(index: number) {
    setChildren(children.filter((_, i) => i !== index))
  }

  async function handleFinish() {
    if (children.length === 0) { setError('Please add at least one child.'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName })
      .select()
      .single()

    if (familyError) { setError(familyError.message); setLoading(false); return }

    const { error: guardianError } = await supabase
      .from('guardians')
      .insert({
        family_id: family.id,
        auth_user_id: user.id,
        name: user.user_metadata?.name || 'Parent',
        email: user.email,
        parent_pin: parentPin,
      })

    if (guardianError) { setError(guardianError.message); setLoading(false); return }

    const { error: childrenError } = await supabase
      .from('children')
      .insert(children.map(c => ({ ...c, family_id: family.id })))

    if (childrenError) { setError(childrenError.message); setLoading(false); return }

    router.push('/dashboard')
    router.refresh()
  }

  // Step 1: Family name
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-300 to-blue-300 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-2">🏠</div>
            <h1 className="text-2xl font-bold text-white drop-shadow">Step 1 of 3</h1>
            <p className="text-white/80">What's your family called?</p>
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Family name</label>
              <input
                type="text"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="e.g. The Jassi Family"
                onKeyDown={e => e.key === 'Enter' && familyName.trim() && setStep(2)}
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={() => { if (familyName.trim()) { setError(''); setStep(2) } else setError('Please enter a family name.') }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-xl shadow-md hover:opacity-90 transition"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Parent PIN
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-300 to-blue-300 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-2">🔐</div>
            <h1 className="text-2xl font-bold text-white drop-shadow">Step 2 of 3</h1>
            <p className="text-white/80">Set your parent PIN</p>
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <p className="text-sm text-gray-500">This 4-digit PIN lets you exit Kid Mode. Keep it secret from the kids!</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">4-digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={parentPin}
                onChange={e => setParentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="••••"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setError(''); setStep(1) }} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
                ← Back
              </button>
              <button
                onClick={() => {
                  if (parentPin.length !== 4) { setError('PIN must be 4 digits.'); return }
                  if (parentPin !== confirmPin) { setError("PINs don't match."); return }
                  setError(''); setStep(3)
                }}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-xl shadow-md hover:opacity-90 transition"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Add children
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-300 to-blue-300 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">👧👦</div>
          <h1 className="text-2xl font-bold text-white drop-shadow">Step 3 of 3</h1>
          <p className="text-white/80">Add your children</p>
        </div>
        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-5">

          {children.length > 0 && (
            <div className="space-y-2">
              {children.map((child, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: child.colour + '25' }}>
                  <span className="text-2xl">{child.avatar}</span>
                  <span className="font-semibold text-gray-800 flex-1">{child.name}</span>
                  <button onClick={() => removeChild(i)} className="text-gray-300 hover:text-red-400 text-xl font-bold">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border border-gray-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-700">Add a child</p>
            <input
              type="text"
              value={currentChild.name}
              onChange={e => setCurrentChild({ ...currentChild, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Child's name"
            />

            <div>
              <p className="text-xs text-gray-500 mb-2">Choose an avatar</p>
              <div className="grid grid-cols-6 gap-1">
                {AVATARS.map(a => (
                  <button
                    key={a}
                    onClick={() => setCurrentChild({ ...currentChild, avatar: a })}
                    className={`text-2xl p-1.5 rounded-xl transition ${currentChild.avatar === a ? 'bg-purple-100 ring-2 ring-purple-400' : 'hover:bg-gray-100'}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Choose a colour</p>
              <div className="flex gap-2 flex-wrap">
                {COLOURS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrentChild({ ...currentChild, colour: c })}
                    className={`w-8 h-8 rounded-full transition ${currentChild.colour === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={addChild}
              disabled={!currentChild.name.trim()}
              className="w-full border-2 border-dashed border-purple-300 text-purple-600 font-semibold py-2 rounded-xl hover:bg-purple-50 transition disabled:opacity-40"
            >
              + Add {currentChild.name.trim() || 'child'}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => { setError(''); setStep(2) }} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
              ← Back
            </button>
            <button
              onClick={handleFinish}
              disabled={loading || children.length === 0}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-xl shadow-md hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? 'Setting up...' : "Let's go! 🚀"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
