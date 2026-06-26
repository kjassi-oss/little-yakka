'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const RAINBOW = 'linear-gradient(135deg, #FF595E, #FFCA3A, #8AC926, #1982C4, #6A4C93)'
const AVATARS = ['🐨','🦁','🐯','🦊','🐻','🐼','🐸','🦄','🐙','🦋','🐬','🦉']
const COLOURS = ['#FF6B6B','#FF9F43','#FFC312','#A3CB38','#12CBC4','#1289A7','#9B59B6','#FDA7DF']
const TASK_EMOJIS = ['🛏️','🧹','🍽️','🧺','📚','🐕','🪥','🚿','👕','🎒','🏃','🎨']
const REWARD_EMOJIS = ['🎁','🍦','🎬','🍕','🎮','📱','🏖️','🎨','🍫','🎪','🏆','⚽']

interface ChildDraft { name: string; avatar: string; colour: string; photo?: File }
interface TaskDraft { title: string; emoji: string; star_value: number }
interface RewardDraft { title: string; emoji: string; star_cost: number }

// Module-scope so they keep a stable identity (no remount / focus loss while typing)
function Shell({ icon, n, title, sub, children: body }: { icon: string; n: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: RAINBOW }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">{icon}</div>
          <h1 className="text-2xl font-black text-white drop-shadow" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>{title}</h1>
          <p className="text-white/85 text-sm">{n} · {sub}</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-5 space-y-4">{body}</div>
      </div>
    </div>
  )
}

function emojiGrid(list: string[], val: string, set: (e: string) => void) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {list.map(e => (
        <button key={e} onClick={() => set(e)} className={`text-2xl p-1 rounded-xl ${val === e ? 'ring-2 ring-pink-400 bg-pink-50' : 'hover:bg-gray-100'}`}>{e}</button>
      ))}
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [familyName, setFamilyName] = useState('')
  const [parentPin, setParentPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  const [children, setChildren] = useState<ChildDraft[]>([])
  const [tasks, setTasks] = useState<TaskDraft[]>([])
  const [rewards, setRewards] = useState<RewardDraft[]>([])

  // current drafts
  const [child, setChild] = useState<ChildDraft>({ name: '', avatar: '🐨', colour: '#FF6B6B' })
  const [task, setTask] = useState<TaskDraft>({ title: '', emoji: '🛏️', star_value: 3 })
  const [reward, setReward] = useState<RewardDraft>({ title: '', emoji: '🎁', star_cost: 10 })
  const photoRef = useRef<HTMLInputElement>(null)

  function addChild() {
    if (!child.name.trim()) return
    setChildren([...children, { ...child, name: child.name.trim() }])
    setChild({ name: '', avatar: '🐨', colour: '#FF6B6B' })
  }
  function addTask() {
    if (!task.title.trim()) return
    setTasks([...tasks, { ...task, title: task.title.trim() }])
    setTask({ title: '', emoji: '🛏️', star_value: 3 })
  }
  function addReward() {
    if (!reward.title.trim()) return
    setRewards([...rewards, { ...reward, title: reward.title.trim() }])
    setReward({ title: '', emoji: '🎁', star_cost: 10 })
  }

  async function handleFinish() {
    if (children.length === 0) { setError('Please add at least one child.'); setStep(3); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: family, error: famErr } = await supabase.from('families').insert({ name: familyName || "My Family" }).select('id').single()
    if (famErr || !family) { setError(famErr?.message || 'Failed to create family'); setLoading(false); return }

    const { error: gErr } = await supabase.from('guardians').insert({
      family_id: family.id, auth_user_id: user.id,
      name: user.user_metadata?.name || user.user_metadata?.full_name || 'Parent',
      email: user.email, parent_pin: parentPin,
    })
    if (gErr) { setError(gErr.message); setLoading(false); return }

    // Children (one by one to get ids + upload photos)
    const childIds: string[] = []
    for (const c of children) {
      const { data: created } = await supabase.from('children')
        .insert({ name: c.name, avatar: c.avatar, colour: c.colour, family_id: family.id }).select('id').single()
      if (!created) continue
      childIds.push(created.id)
      if (c.photo) {
        const ext = c.photo.name.split('.').pop()
        const path = `${family.id}/${created.id}/avatar.${ext}`
        const { error: upErr } = await supabase.storage.from('kid-avatars').upload(path, c.photo, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('kid-avatars').getPublicUrl(path)
          await supabase.from('children').update({ avatar_url: publicUrl }).eq('id', created.id)
        }
      }
    }

    // Tasks (assigned to all children)
    for (const t of tasks) {
      const { data: createdTask } = await supabase.from('tasks').insert({
        family_id: family.id, title: t.title, emoji: t.emoji, star_value: t.star_value,
        type: 'chore', time_of_day: null, frequency: 'daily', recurrence: 'daily', carry_over: true,
      }).select('id').single()
      if (createdTask && childIds.length) {
        await supabase.from('task_assignments').insert(childIds.map(cid => ({ task_id: createdTask.id, child_id: cid })))
      }
    }

    // Rewards (family-wide)
    for (const r of rewards) {
      await supabase.from('rewards').insert({
        family_id: family.id, title: r.title, emoji: r.emoji, star_cost: r.star_cost, scope: 'family', child_id: null,
      })
    }

    router.push('/dashboard'); router.refresh()
  }

  // STEP 1 — family name
  if (step === 1) return (
    <Shell icon="🏠" n="Step 1 of 5" title="Your family" sub="What should we call it?">
      <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
        className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
        placeholder="e.g. The Jassi Family" onKeyDown={e => e.key === 'Enter' && familyName.trim() && setStep(2)}/>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <button onClick={() => familyName.trim() ? (setError(''), setStep(2)) : setError('Please enter a family name.')}
        className="w-full text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>Next →</button>
    </Shell>
  )

  // STEP 2 — parent PIN
  if (step === 2) return (
    <Shell icon="🔐" n="Step 2 of 5" title="Parent PIN" sub="Keeps Kid Mode safe">
      <p className="text-sm text-gray-500">A 4-digit PIN to exit Kid Mode and approve things. Keep it secret!</p>
      <input type="password" inputMode="numeric" maxLength={4} value={parentPin}
        onChange={e => setParentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="••••"/>
      <input type="password" inputMode="numeric" maxLength={4} value={confirmPin}
        onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="Confirm"/>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setError(''); setStep(1) }} className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold">← Back</button>
        <button onClick={() => {
          if (parentPin.length !== 4) { setError('PIN must be 4 digits.'); return }
          if (parentPin !== confirmPin) { setError("PINs don't match."); return }
          setError(''); setStep(3)
        }} className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>Next →</button>
      </div>
    </Shell>
  )

  // STEP 3 — children
  if (step === 3) return (
    <Shell icon="👧👦" n="Step 3 of 5" title="Add your kids" sub="Add one or more children">
      {children.length > 0 && (
        <div className="space-y-2">
          {children.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl" style={{ backgroundColor: c.colour + '22' }}>
              {c.photo
                ? <img src={URL.createObjectURL(c.photo)} className="w-9 h-9 rounded-xl object-cover" alt=""/>
                : <span className="text-2xl">{c.avatar}</span>}
              <span className="font-semibold text-gray-800 flex-1">{c.name}</span>
              <button onClick={() => setChildren(children.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xl font-bold">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => photoRef.current?.click()} className="relative flex-shrink-0">
            {child.photo
              ? <img src={URL.createObjectURL(child.photo)} className="w-14 h-14 rounded-2xl object-cover" style={{ border: `3px solid ${child.colour}` }} alt=""/>
              : <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs shadow">📷</div>
          </button>
          <input type="file" accept="image/*" className="hidden" ref={photoRef} onChange={e => e.target.files?.[0] && setChild({ ...child, photo: e.target.files[0] })}/>
          <input type="text" value={child.name} onChange={e => setChild({ ...child, name: e.target.value })}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="Child's name"/>
        </div>
        <p className="text-[11px] text-gray-400 -mt-1">Tap the picture to add a photo (optional)</p>
        {emojiGrid(AVATARS, child.avatar, a => setChild({ ...child, avatar: a }))}
        <div className="flex gap-2 flex-wrap">
          {COLOURS.map(c => (
            <button key={c} onClick={() => setChild({ ...child, colour: c })}
              className={`w-8 h-8 rounded-full ${child.colour === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}`} style={{ backgroundColor: c }}/>
          ))}
        </div>
        <button onClick={addChild} disabled={!child.name.trim()}
          className="w-full font-bold py-2.5 rounded-xl text-sm active:scale-95 transition disabled:opacity-40 text-white" style={{ background: RAINBOW }}>
          {children.length > 0 ? '＋ Save & add another' : `Save ${child.name.trim() || 'child'}`}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setError(''); setStep(2) }} className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold">← Back</button>
        <button onClick={() => children.length > 0 ? (setError(''), setStep(4)) : setError('Add at least one child to continue.')}
          className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>Next →</button>
      </div>
    </Shell>
  )

  // STEP 4 — first task(s)
  if (step === 4) return (
    <Shell icon="📋" n="Step 4 of 5" title="Create your first task!" sub="Optional — you can add more later">
      {tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((t, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50">
              <span className="text-2xl">{t.emoji}</span>
              <span className="font-semibold text-gray-800 flex-1">{t.title}</span>
              <span className="text-yellow-500 font-bold text-sm">⭐ {t.star_value}</span>
              <button onClick={() => setTasks(tasks.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xl font-bold">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
        <input type="text" value={task.title} onChange={e => setTask({ ...task, title: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="e.g. Make bed"/>
        {emojiGrid(TASK_EMOJIS, task.emoji, e => setTask({ ...task, emoji: e }))}
        <div>
          <p className="text-xs text-gray-500 mb-1">Stars: <span className="font-bold text-yellow-500">⭐ {task.star_value}</span></p>
          <input type="range" min={1} max={10} value={task.star_value} onChange={e => setTask({ ...task, star_value: Number(e.target.value) })} className="w-full"/>
        </div>
        <button onClick={addTask} disabled={!task.title.trim()}
          className="w-full font-bold py-2.5 rounded-xl text-sm active:scale-95 transition disabled:opacity-40 text-white" style={{ background: RAINBOW }}>
          {tasks.length > 0 ? '＋ Add another task' : 'Save task'}
        </button>
        <p className="text-[11px] text-gray-400 text-center">Tasks are assigned to all your kids — fine-tune later in the Tasks tab.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setStep(3)} className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold">← Back</button>
        <button onClick={() => setStep(5)} className="px-4 py-3 rounded-2xl text-gray-500 font-semibold">Skip</button>
        <button onClick={() => setStep(5)} className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>Next →</button>
      </div>
    </Shell>
  )

  // STEP 5 — rewards
  return (
    <Shell icon="🎁" n="Step 5 of 5" title="Create your rewards!" sub="What can kids spend stars on?">
      {rewards.length > 0 && (
        <div className="space-y-2">
          {rewards.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50">
              <span className="text-2xl">{r.emoji}</span>
              <span className="font-semibold text-gray-800 flex-1">{r.title}</span>
              <span className="text-yellow-500 font-bold text-sm">⭐ {r.star_cost}</span>
              <button onClick={() => setRewards(rewards.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xl font-bold">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
        <input type="text" value={reward.title} onChange={e => setReward({ ...reward, title: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="e.g. Movie night"/>
        {emojiGrid(REWARD_EMOJIS, reward.emoji, e => setReward({ ...reward, emoji: e }))}
        <div>
          <p className="text-xs text-gray-500 mb-1">Cost: <span className="font-bold text-yellow-500">⭐ {reward.star_cost}</span></p>
          <input type="range" min={1} max={100} value={reward.star_cost} onChange={e => setReward({ ...reward, star_cost: Number(e.target.value) })} className="w-full"/>
        </div>
        <button onClick={addReward} disabled={!reward.title.trim()}
          className="w-full font-bold py-2.5 rounded-xl text-sm active:scale-95 transition disabled:opacity-40 text-white" style={{ background: RAINBOW }}>
          {rewards.length > 0 ? '＋ Add another reward' : 'Save reward'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setStep(4)} className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold">← Back</button>
        <button onClick={handleFinish} disabled={loading}
          className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60" style={{ background: RAINBOW }}>
          {loading ? 'Setting up...' : "Finish — let's go! 🚀"}
        </button>
      </div>
    </Shell>
  )
}
