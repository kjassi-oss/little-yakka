'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageCompress'

const RAINBOW = 'var(--theme-gradient)'
const DISPLAY = 'var(--font-display), system-ui, sans-serif'

const AVATARS = ['🐨','🦁','🐯','🦊','🐻','🐼','🐸','🦄','🐙','🦉']
const COLOURS = ['#FF6B6B','#FF9F43','#FFC312','#A3CB38','#12CBC4','#1289A7','#9B59B6','#FDA7DF']
const TASK_EMOJIS = [
  '⭐','🛏️','🧹','🍽️','🧺','📚','🐕','🪥','🚿','👕','🎒','🏃',
  '🎨','📖','📝','🌿','🗑️','♻️','🍳','🧽','🥤','🍎','🥕','💊',
]
const REWARD_EMOJIS = ['🎁','🍦','🎬','🍔','🎮','📱','🍿','🎨','🍫','🍭','🏆','⚽','🛍️','🎡','🍰','🎠']

// Predefined starters — tap to auto-fill name + icon, then tweak the full form
const PREDEFINED_TASKS: { title: string; emoji: string }[] = [
  { title: 'Clean Bedroom', emoji: '🧹' }, { title: 'Homework', emoji: '📝' },
  { title: 'Music Practice', emoji: '🎵' }, { title: 'Wash Dishes', emoji: '🍽️' },
  { title: 'Do Laundry', emoji: '🧺' }, { title: 'Cut Grass', emoji: '🌿' },
  { title: 'Wash Car', emoji: '🚗' }, { title: 'Make Your Bed', emoji: '🛏️' },
  { title: 'Take Out Rubbish', emoji: '🗑️' }, { title: 'Walk The Dog', emoji: '🐕' },
  { title: 'Reading', emoji: '📖' }, { title: 'Brush Teeth', emoji: '🪥' },
]
const PREDEFINED_REWARDS: { title: string; emoji: string }[] = [
  { title: 'Ice Cream', emoji: '🍦' }, { title: 'iPad Time', emoji: '📱' },
  { title: 'Go To Movies', emoji: '🎬' }, { title: 'Takeaway', emoji: '🍔' },
  { title: 'Choose Dessert', emoji: '🍰' }, { title: 'Stay Up Extra 30 Mins', emoji: '🌙' },
  { title: '30 Mins Computer Games', emoji: '🎮' }, { title: 'Lollie', emoji: '🍭' },
  { title: 'Choose Family Movie', emoji: '🍿' },
]

const FREQ = [{ v: 'daily', l: '📅 Daily' }, { v: 'weekly', l: '🗓️ Weekly' }, { v: 'monthly', l: '📆 Monthly' }] as const
const TIMES = [{ v: 'anytime', l: '📋 Anytime' }, { v: 'morning', l: '🌅 Morning' }, { v: 'afternoon', l: '☀️ Afternoon' }, { v: 'evening', l: '🌙 Evening' }] as const
const TYPES = [{ v: 'chore', l: 'Chore' }, { v: 'routine', l: 'Routine' }] as const
const DAYS = [['M',1],['T',2],['W',3],['T',4],['F',5],['S',6],['S',0]] as const

interface ChildDraft { name: string; age: string; avatar: string; colour: string; photo?: File }
interface TaskDraft {
  title: string; emoji: string; type: string; star_value: number; frequency: string
  time_of_day: string; start_date: string; carry_over: boolean
  can_do_early: boolean; days_of_week: number[]
}
interface RewardDraft { title: string; emoji: string; star_cost: number }

const blankTask = (): TaskDraft => ({
  title: '', emoji: '⭐', type: 'chore', star_value: 3, frequency: 'daily',
  time_of_day: 'anytime', start_date: '', carry_over: false,
  can_do_early: false, days_of_week: [0, 1, 2, 3, 4, 5, 6], // daily, every day on by default
})

// Full-bleed white page with the logo centred at the top, consistent on every step.
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="pt-12 pb-3 flex justify-center">
        <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto"/>
      </div>
      <div className="flex-1 w-full max-w-sm mx-auto px-5 pb-12">{children}</div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-base text-gray-900 text-center mb-1.5" style={{ fontFamily: DISPLAY }}>{children}</p>
}

// Multicolour playful step title
function GradientTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-3xl font-black text-center mb-1" style={{ fontFamily: DISPLAY, background: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
      {children}
    </h1>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 text-sm font-bold text-gray-400 active:scale-95 transition mb-1">
      ← Back
    </button>
  )
}

function Toggle({ on, onToggle, label, sub }: { on: boolean; onToggle: () => void; label: string; sub: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
      <button onClick={onToggle}
        className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? '' : 'bg-gray-200'}`}
        style={on ? { background: RAINBOW } : {}}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-0.5'}`}/>
      </button>
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [skipped, setSkipped] = useState(false)

  const [familyName, setFamilyName] = useState('')
  const [children, setChildren] = useState<ChildDraft[]>([])
  const [tasks, setTasks] = useState<TaskDraft[]>([])
  const [rewards, setRewards] = useState<RewardDraft[]>([])

  const [child, setChild] = useState<ChildDraft>({ name: '', age: '', avatar: '🐨', colour: COLOURS[0] })
  const [bonusOn, setBonusOn] = useState(false)
  const [bonusCadence, setBonusCadence] = useState<'weekly' | 'monthly'>('weekly')
  const [bonusDay, setBonusDay] = useState(0)      // weekly: day of week (0=Sun)
  const [bonusDate, setBonusDate] = useState(1)    // monthly: date of month
  const [bonusTime, setBonusTime] = useState('16:00')
  const [bonusAwardPct, setBonusAwardPct] = useState(50)
  const [task, setTask] = useState<TaskDraft>(blankTask())
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [reward, setReward] = useState<RewardDraft>({ title: '', emoji: '🎁', star_cost: 10 })
  const [rewardFormOpen, setRewardFormOpen] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  function addChild(): boolean {
    if (!child.name.trim()) { setError('Please enter your child\'s name.'); return false }
    setChildren(prev => [...prev, { ...child, name: child.name.trim(), colour: COLOURS[prev.length % COLOURS.length] }])
    setChild({ name: '', age: '', avatar: '🐨', colour: COLOURS[(children.length + 1) % COLOURS.length] })
    setError('')
    return true
  }

  function pickAvatar(a: string) {
    if (child.photo && !confirm('Replace your uploaded photo with this avatar?')) return
    setChild({ ...child, avatar: a, photo: undefined })
  }
  function uploadPhoto(file: File) {
    setChild({ ...child, photo: file })
  }

  function startTask(preset?: { title: string; emoji: string }) {
    setTask({ ...blankTask(), title: preset?.title || '', emoji: preset?.emoji || '⭐' })
    setTaskFormOpen(true)
  }
  function saveTask() {
    if (!task.title.trim()) { setError('Please give the task a name.'); return }
    setTasks([...tasks, { ...task, title: task.title.trim() }])
    setTask(blankTask()); setTaskFormOpen(false); setError('')
  }

  function startReward(preset?: { title: string; emoji: string }) {
    setReward({ title: preset?.title || '', emoji: preset?.emoji || '🎁', star_cost: 10 })
    setRewardFormOpen(true)
  }
  function saveReward() {
    if (!reward.title.trim()) { setError('Please give the reward a name.'); return }
    setRewards([...rewards, { ...reward, title: reward.title.trim() }])
    setReward({ title: '', emoji: '🎁', star_cost: 10 }); setRewardFormOpen(false); setError('')
  }

  // Create the family + guardian row (always needed so the dashboard works)
  async function createFamily() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return null }
    const { data: family, error: famErr } = await supabase.from('families')
      .insert({ name: familyName.trim() || 'My Family' }).select('id').single()
    if (famErr || !family) { setError(famErr?.message || 'Failed to create family'); return null }
    const { error: gErr } = await supabase.from('guardians').insert({
      family_id: family.id, auth_user_id: user.id,
      name: user.user_metadata?.name || user.user_metadata?.full_name || 'Parent',
      email: user.email, parent_pin: '',
    })
    if (gErr) { setError(gErr.message); return null }
    return { supabase, familyId: family.id }
  }

  async function skipAll() {
    setLoading(true); setError('')
    const ctx = await createFamily()
    if (!ctx) { setLoading(false); return }
    setSkipped(true)
  }

  // Back from step 1 leaves setup entirely — sign out so /login doesn't bounce
  // an authenticated user straight back here.
  async function backToLogin() {
    await createClient().auth.signOut()
    router.push('/login'); router.refresh()
  }

  async function handleFinish(skipBonus = false) {
    if (children.length === 0) { setError('Please add at least one child.'); setStep(1); return }
    setLoading(true); setError('')
    const ctx = await createFamily()
    if (!ctx) { setLoading(false); return }
    const { supabase, familyId } = ctx

    const childIds: string[] = []
    for (const c of children) {
      const baseChild: any = { name: c.name, avatar: c.avatar, colour: c.colour, family_id: familyId }
      let { data: created } = await supabase.from('children')
        .insert({ ...baseChild, age: c.age ? Number(c.age) : null }).select('id').single()
      if (!created) { // age column may not exist yet — retry without it
        const retry = await supabase.from('children').insert(baseChild).select('id').single()
        created = retry.data
      }
      if (!created) continue
      childIds.push(created.id)
      if (c.photo) {
        const photo = await compressImage(c.photo)
        const ext = photo.name.split('.').pop()
        const path = `${familyId}/${created.id}/avatar.${ext}`
        const { error: upErr } = await supabase.storage.from('kid-avatars').upload(path, photo, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('kid-avatars').getPublicUrl(path)
          await supabase.from('children').update({ avatar_url: publicUrl }).eq('id', created.id)
        }
      }
    }

    for (const t of tasks) {
      const taskPayload: any = {
        family_id: familyId, title: t.title, emoji: t.emoji, star_value: t.star_value,
        type: t.type, time_of_day: t.time_of_day === 'anytime' ? null : t.time_of_day,
        frequency: t.frequency, recurrence: t.frequency,
        carry_over: t.carry_over,
        start_date: t.start_date || null,
        days_of_week: t.frequency === 'daily' && t.days_of_week.length > 0 && t.days_of_week.length < 7
          ? [...t.days_of_week].sort() : null,
      }
      // Try with can_do_early; fall back gracefully if the column doesn't exist yet
      const { data: createdTask, error: taskErr } = await supabase.from('tasks')
        .insert({ ...taskPayload, can_do_early: t.can_do_early }).select('id').single()
      const finalTask = createdTask || (taskErr?.message?.includes('can_do_early')
        ? (await supabase.from('tasks').insert(taskPayload).select('id').single()).data
        : null)
      if (finalTask && childIds.length) {
        await supabase.from('task_assignments').insert(childIds.map(cid => ({ task_id: finalTask.id, child_id: cid })))
      }
    }

    for (const r of rewards) {
      await supabase.from('rewards').insert({
        family_id: familyId, title: r.title, emoji: r.emoji,
        star_cost: r.star_cost, scope: 'family', child_id: null,
      })
    }

    // Optional Bonus Wheel from step 4
    if (bonusOn && !skipBonus) {
      const bonusBase = {
        bonus_cadence: bonusCadence,
        bonus_day: bonusCadence === 'monthly' ? bonusDate : bonusDay,
        bonus_time: bonusTime,
      }
      const { error: bonusErr } = await supabase.from('families')
        .update({ ...bonusBase, bonus_award_pct: bonusAwardPct }).eq('id', familyId)
      if (bonusErr) await supabase.from('families').update(bonusBase).eq('id', familyId)
    }

    router.push('/dashboard'); router.refresh()
  }

  // ── Skipped confirmation ────────────────────────────────────────────────────
  if (skipped) return (
    <Page>
      <div className="flex flex-col items-center text-center pt-10">
        <div className="text-6xl mb-4">👋</div>
        <h1 className="text-2xl text-gray-900 mb-2" style={{ fontFamily: DISPLAY }}>All good — you're set!</h1>
        <p className="text-gray-500 mb-8">Children can be set up in <span className="font-bold text-gray-700">Settings</span> whenever you're ready.</p>
        <button onClick={() => { router.push('/dashboard'); router.refresh() }}
          className="w-full text-white font-black py-3.5 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>
          Go to Home →
        </button>
      </div>
    </Page>
  )

  // ── STEP 1 — child details ──────────────────────────────────────────────────
  if (step === 1) return (
    <Page>
      <BackBtn onClick={backToLogin}/>
      <GradientTitle>Family Details</GradientTitle>
      <p className="text-sm text-gray-400 text-center mb-5">Tell us about your family</p>

      {children.length > 0 && (
        <div className="flex gap-2 flex-wrap justify-center mb-5">
          {children.map((c, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="relative">
                {c.photo
                  ? <img src={URL.createObjectURL(c.photo)} className="w-12 h-12 rounded-2xl object-cover" alt=""/>
                  : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: c.colour + '33' }}>{c.avatar}</div>}
                <button onClick={() => setChildren(children.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-200 text-gray-500 rounded-full text-xs font-bold flex items-center justify-center">×</button>
              </div>
              <span className="text-[11px] font-semibold text-gray-600 mt-1 max-w-[56px] truncate">{c.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        <Label>Family Name</Label>
        <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
          className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
          placeholder="e.g. The Jassi Family"/>
      </div>

      {/* Child's name (wide) + age (narrow) on one row */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <Label>Childs Name</Label>
          <input type="text" value={child.name} onChange={e => setChild({ ...child, name: e.target.value })}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-center text-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder="Name"/>
        </div>
        <div className="w-24">
          <Label>Age</Label>
          <input type="number" inputMode="numeric" min={1} max={18} value={child.age}
            onChange={e => setChild({ ...child, age: e.target.value })}
            className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-center text-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder="—"/>
        </div>
      </div>

      <div className="mb-5">
        <Label>Choose a Picture</Label>
        <button onClick={() => photoRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-3 text-sm font-semibold text-gray-500 mb-3 active:scale-95 transition">
          {child.photo ? '📷 Photo added — tap to change' : '📷 Upload a photo'}
        </button>
        <input type="file" accept="image/*" className="hidden" ref={photoRef}
          onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])}/>
        {child.photo && (
          <div className="flex justify-center mb-3">
            <img src={URL.createObjectURL(child.photo)} className="w-20 h-20 rounded-2xl object-cover" style={{ border: `3px solid ${child.colour}` }} alt=""/>
          </div>
        )}
        <p className="text-xs text-gray-400 text-center mb-2">…or pick an avatar</p>
        <div className="grid grid-cols-10 gap-1">
          {AVATARS.map(a => (
            <button key={a} onClick={() => pickAvatar(a)}
              className={`aspect-square rounded-lg flex items-center justify-center text-base transition ${!child.photo && child.avatar === a ? 'ring-2 ring-pink-400 bg-pink-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

      <button onClick={() => { if (child.name.trim()) addChild() }}
        className="w-full py-2.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm mb-3 active:scale-95 transition">
        Add Another Child
      </button>
      <button onClick={() => {
        // auto-save the in-progress child, then continue
        if (child.name.trim()) { if (!addChild()) return }
        if (children.length === 0 && !child.name.trim()) { setError('Please add your child\'s details.'); return }
        setError(''); setStep(2)
      }}
        className="w-full text-white font-black py-3.5 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>
        Next →
      </button>
      <button onClick={skipAll} disabled={loading}
        className="w-full text-center text-xs font-bold text-gray-400 mt-3 active:scale-95 transition disabled:opacity-50">
        Set Up Later
      </button>
    </Page>
  )

  // ── STEP 2 — tasks ──────────────────────────────────────────────────────────
  if (step === 2) return (
    <Page>
      <BackBtn onClick={() => { setError(''); setStep(1) }}/>
      <GradientTitle>Create Tasks</GradientTitle>
      <p className="text-sm text-gray-400 text-center mb-5">Tap a starter or create your own</p>

      {tasks.length > 0 && (
        <div className="space-y-2 mb-5">
          {tasks.map((t, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50">
              <span className="text-2xl">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{t.title}</p>
                <p className="text-[11px] text-gray-400">{t.frequency} · {t.time_of_day} · ⭐ {t.star_value}</p>
              </div>
              <button onClick={() => setTasks(tasks.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xl font-bold">×</button>
            </div>
          ))}
        </div>
      )}

      {!taskFormOpen ? (
        <>
          <div className="grid grid-cols-4 gap-2.5 mb-4">
            {PREDEFINED_TASKS.map(p => (
              <button key={p.title} onClick={() => startTask(p)}
                className="flex flex-col items-center gap-1 active:scale-95 transition">
                <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl">{p.emoji}</div>
                <span className="text-[10px] font-semibold text-gray-500 text-center leading-tight">{p.title}</span>
              </button>
            ))}
          </div>
          <button onClick={() => startTask()}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm active:scale-95 transition mb-4">
            ✏️ Create your own
          </button>

          <button onClick={() => { setError(''); setStep(3) }}
            className="w-full text-white font-black py-3.5 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>
            Next Step →
          </button>
          <button onClick={() => handleFinish(true)} disabled={loading}
            className="w-full text-center text-xs font-bold text-gray-400 mt-3 active:scale-95 transition disabled:opacity-50">
            Set Up Later
          </button>
        </>
      ) : (
        <TaskForm task={task} setTask={setTask} onSave={saveTask} onCancel={() => { setTaskFormOpen(false); setError('') }} error={error}/>
      )}
    </Page>
  )

  // ── STEP 3 — rewards ────────────────────────────────────────────────────────
  if (step === 3) return (
    <Page>
      <BackBtn onClick={() => { setError(''); setStep(2) }}/>
      <GradientTitle>Create Rewards</GradientTitle>
      <p className="text-sm text-gray-400 text-center mb-5">What can kids spend their stars on?</p>

      {rewards.length > 0 && (
        <div className="space-y-2 mb-5">
          {rewards.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50">
              <span className="text-2xl">{r.emoji}</span>
              <span className="font-semibold text-gray-800 flex-1 text-sm">{r.title}</span>
              <span className="text-yellow-500 font-bold text-sm">⭐ {r.star_cost}</span>
              <button onClick={() => setRewards(rewards.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xl font-bold">×</button>
            </div>
          ))}
        </div>
      )}

      {!rewardFormOpen ? (
        <>
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {PREDEFINED_REWARDS.map(p => (
              <button key={p.title} onClick={() => startReward(p)}
                className="flex flex-col items-center gap-1 active:scale-95 transition">
                <div className="w-16 h-16 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-3xl">{p.emoji}</div>
                <span className="text-[10px] font-semibold text-gray-500 text-center leading-tight">{p.title}</span>
              </button>
            ))}
          </div>
          <button onClick={() => startReward()}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm active:scale-95 transition mb-5">
            ✏️ Create your own
          </button>

          {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
          <button onClick={() => { setError(''); setStep(4) }}
            className="w-full text-white font-black py-3.5 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>
            Next Step →
          </button>
          <button onClick={() => handleFinish(true)} disabled={loading}
            className="w-full text-center text-xs font-bold text-gray-400 mt-3 active:scale-95 transition disabled:opacity-50">
            Set Up Later
          </button>
        </>
      ) : (
        <RewardForm reward={reward} setReward={setReward} onSave={saveReward} onCancel={() => { setRewardFormOpen(false); setError('') }} error={error}/>
      )}
    </Page>
  )

  // ── STEP 4 — bonus wheel (optional) ─────────────────────────────────────────
  return (
    <Page>
      <BackBtn onClick={() => { setError(''); setStep(3) }}/>
      <GradientTitle>Bonus Wheel</GradientTitle>
      <p className="text-sm text-gray-400 text-center mb-4">A prize wheel kids can spin for bonus stars</p>

      <div className="rounded-2xl p-3.5 mb-4 text-center border-2 border-dashed space-y-2"
        style={{ background: 'color-mix(in srgb, var(--theme-from) 8%, white)', borderColor: 'var(--theme-from)' }}>
        <p className="text-sm font-bold text-gray-700">
          Kids love the Bonus Wheel! It lets them earn bonus stars based on how many tasks they've completed, making chores fun while strongly encouraging consistent habits.
        </p>
        <p className="text-sm font-black" style={{ color: 'var(--theme-from)' }}>
          ✨ On average, kids complete 30% more tasks when the Bonus Wheel is introduced!
        </p>
      </div>

      <div className="border border-gray-100 rounded-2xl p-4 space-y-3 mb-5">
        <Toggle
          label="Turn on the Bonus Wheel 🎡"
          sub={bonusOn ? 'Kids get a spin at the time you choose' : 'Optional — you can turn it on later in Settings'}
          on={bonusOn} onToggle={() => setBonusOn(!bonusOn)}/>

        {bonusOn && (<>
          <div className="flex bg-gray-100 rounded-2xl p-1">
            {(['weekly', 'monthly'] as const).map(c => (
              <button key={c} onClick={() => setBonusCadence(c)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition ${bonusCadence === c ? 'text-white shadow' : 'text-gray-400'}`}
                style={bonusCadence === c ? { background: RAINBOW } : {}}>{c}</button>
            ))}
          </div>

          {bonusCadence === 'weekly' ? (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">On which day?</p>
              <div className="flex gap-1.5">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((lbl, dow) => (
                  <button key={dow} onClick={() => setBonusDay(dow)}
                    className={`flex-1 h-9 rounded-xl text-xs font-bold transition ${bonusDay === dow ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                    style={bonusDay === dow ? { background: RAINBOW } : {}}>{lbl}</button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">On which date of the month?</p>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <button key={d} onClick={() => setBonusDate(d)}
                    className={`h-9 rounded-lg text-xs font-bold transition ${bonusDate === d ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={bonusDate === d ? { background: RAINBOW } : {}}>{d}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500">Available from</p>
            <input type="time" value={bonusTime} onChange={e => setBonusTime(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"/>
          </div>

          {/* Award value — % of the period's available stars */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">Award value</p>
              <p className="text-xs font-bold" style={{ color: 'var(--theme-from)' }}>{bonusAwardPct}%</p>
            </div>
            <input type="range" min={10} max={100} step={5} value={bonusAwardPct}
              onChange={e => setBonusAwardPct(Number(e.target.value))} className="w-full"/>
            <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
              <span>10% of {bonusCadence === 'monthly' ? 'month' : 'week'}'s stars</span>
              <span>100%</span>
            </div>
          </div>
        </>)}
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
      <button onClick={() => handleFinish()} disabled={loading}
        className="w-full bg-white py-4 rounded-2xl shadow-lg active:scale-95 transition disabled:opacity-60 leading-tight font-black text-xl"
        style={{ border: '2px solid var(--theme-from)' }}>
        <span style={{ fontFamily: DISPLAY, background: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {loading ? 'Setting up…' : 'ALL DONE'}
        </span>
      </button>
      <button onClick={() => handleFinish(true)} disabled={loading}
        className="w-full text-center text-xs font-bold text-gray-400 mt-3 active:scale-95 transition disabled:opacity-50">
        Set Up Later
      </button>
    </Page>
  )
}

// ── Full task form (mirrors the Tasks page options) ───────────────────────────
function TaskForm({ task, setTask, onSave, onCancel, error }: {
  task: TaskDraft; setTask: (t: TaskDraft) => void; onSave: () => void; onCancel: () => void; error: string
}) {
  const [emojiSearch, setEmojiSearch] = useState('')
  return (
    <div className="border border-gray-100 rounded-3xl p-4 space-y-4 shadow-sm">
      <div className="flex bg-gray-100 rounded-2xl p-1">
        {TYPES.map(o => (
          <button key={o.v} onClick={() => setTask({ ...task, type: o.v })}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${task.type === o.v ? 'bg-white shadow' : 'text-gray-400'}`}
            style={task.type === o.v ? { color: 'var(--theme-from)' } : {}}>{o.l}</button>
        ))}
      </div>

      <input type="text" value={task.title} onChange={e => setTask({ ...task, title: e.target.value })}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
        placeholder="Task name"/>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-gray-50">{task.emoji}</div>
          <input type="text" value={emojiSearch} onChange={e => setEmojiSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder="🔍 Search icons"/>
        </div>
        <div className="grid grid-cols-8 gap-1 p-1 bg-gray-50 rounded-2xl">
          {TASK_EMOJIS.map((e, i) => (
            <button key={`${e}-${i}`} onClick={() => setTask({ ...task, emoji: e })}
              className={`text-2xl p-1 rounded-xl ${task.emoji === e ? 'ring-2 ring-pink-400 bg-white' : 'hover:bg-white'}`}>{e}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">How often?</p>
        <div className="flex gap-2">
          {FREQ.map(o => (
            <button key={o.v} onClick={() => setTask({ ...task, frequency: o.v, days_of_week: o.v === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [] })}
              className={`flex-1 py-2 rounded-2xl text-xs font-semibold transition ${task.frequency === o.v ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
              style={task.frequency === o.v ? { background: RAINBOW } : {}}>{o.l}</button>
          ))}
        </div>
      </div>

      {task.frequency === 'daily' && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Which days? <span className="text-gray-300">{task.days_of_week.length === 0 ? '(every day)' : ''}</span></p>
          <div className="flex gap-1.5">
            {DAYS.map(([lbl, dow]) => {
              const on = task.days_of_week.includes(dow)
              return (
                <button key={dow} onClick={() => setTask({
                  ...task,
                  days_of_week: on ? task.days_of_week.filter(x => x !== dow) : [...task.days_of_week, dow]
                })}
                  className={`flex-1 h-9 rounded-xl text-xs font-bold transition ${on ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                  style={on ? { background: RAINBOW } : {}}>{lbl}</button>
              )
            })}
          </div>
        </div>
      )}

      {/* Time of day + start date on one row */}
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">Time of day</p>
          <select value={task.time_of_day} onChange={e => setTask({ ...task, time_of_day: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-300">
            {TIMES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">Start date</p>
          <input type="date" value={task.start_date} onChange={e => setTask({ ...task, start_date: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"/>
        </div>
      </div>

      <Toggle label="Carry over if missed ↩️"
        sub={task.carry_over ? 'Shows as overdue if not done' : 'Expires — no carry over'}
        on={task.carry_over} onToggle={() => setTask({ ...task, carry_over: !task.carry_over })}/>

      <Toggle label="Can be done early 🗓️"
        sub={task.can_do_early ? 'Kids can do future days now' : 'Only on the scheduled day'}
        on={task.can_do_early} onToggle={() => setTask({ ...task, can_do_early: !task.can_do_early })}/>

      <div>
        <p className="text-xs text-gray-500 mb-1">Stars to earn ⭐</p>
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={50} value={Math.min(task.star_value, 50)}
            onChange={e => setTask({ ...task, star_value: Number(e.target.value) })} className="flex-1"/>
          <input type="number" inputMode="numeric" min={1} value={task.star_value}
            onChange={e => setTask({ ...task, star_value: Math.max(1, Number(e.target.value) || 1) })}
            className="w-20 border border-gray-200 rounded-xl px-2 py-2 text-center font-black text-yellow-500 focus:outline-none focus:ring-2 focus:ring-pink-300"/>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>25</span><span>50 · or type any number →</span></div>
      </div>

      <p className="text-[11px] text-gray-400 text-center">Tasks are assigned to all your kids — adjust later in the Tasks tab.</p>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold">Cancel</button>
        <button onClick={onSave} className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>
          Save task ✓
        </button>
      </div>
    </div>
  )
}

// ── Reward form ───────────────────────────────────────────────────────────────
function RewardForm({ reward, setReward, onSave, onCancel, error }: {
  reward: RewardDraft; setReward: (r: RewardDraft) => void; onSave: () => void; onCancel: () => void; error: string
}) {
  return (
    <div className="border border-gray-100 rounded-3xl p-4 space-y-4 shadow-sm">
      <input type="text" value={reward.title} onChange={e => setReward({ ...reward, title: e.target.value })}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
        placeholder="Reward name"/>
      <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto p-1 bg-gray-50 rounded-2xl">
        {REWARD_EMOJIS.map((e, i) => (
          <button key={`${e}-${i}`} onClick={() => setReward({ ...reward, emoji: e })}
            className={`text-2xl p-1 rounded-xl ${reward.emoji === e ? 'ring-2 ring-pink-400 bg-white' : 'hover:bg-white'}`}>{e}</button>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Cost: <span className="font-bold text-yellow-500">⭐ {reward.star_cost}</span></p>
        <input type="range" min={1} max={500} value={reward.star_cost}
          onChange={e => setReward({ ...reward, star_cost: Number(e.target.value) })} className="w-full"/>
        <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>100</span><span>250</span><span>500</span></div>
      </div>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold">Cancel</button>
        <button onClick={onSave} className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition" style={{ background: RAINBOW }}>
          Save reward ✓
        </button>
      </div>
    </div>
  )
}
