'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SpinWheel from '@/components/SpinWheel'

interface Occurrence { id: string; taskId: string; title: string; emoji: string; star_value: number; time_of_day: string | null; date: string; canDoEarly: boolean }

const TIME_SORT: Record<string, number> = { anytime: 0, morning: 1, afternoon: 2, evening: 3 }
function sortOccs(occs: Occurrence[]) {
  return [...occs].sort((a, b) =>
    (TIME_SORT[a.time_of_day ?? 'anytime'] ?? 0) - (TIME_SORT[b.time_of_day ?? 'anytime'] ?? 0)
  )
}
interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string }
interface Reward { id: string; title: string; emoji: string; star_cost: number }
interface Praise { id: string; message: string }
interface DoneItem { key: string; date: string; createdAt: string; title: string; emoji: string; starValue: number }

interface Props {
  child: Child
  occurrences: Occurrence[]
  completedKeys: string[]
  weekEndStr: string
  mondayStr: string
  todayStr: string
  starBalance: number
  rewards: Reward[]
  pendingRewardIds: string[]
  hasSpunToday: boolean
  bonusCadence: 'daily' | 'weekly'
  bonusDay: number
  bonusTime: string
  maxPrize: number
  streakDays: number
  doneHistory: DoneItem[]
  unseenPraises: Praise[]
  highlightTaskId?: string | null
}

const RAINBOW = 'linear-gradient(135deg, #16BDCA, #F59E0B, #7C3AED, #22B14C)'
const CELEBRATION_EMOJIS = ['⭐','🎉','✨','🌟','🎊','💫','🏆','🥳','🎈','🌈']

function dateLabel(ds: string, todayStr: string): string {
  if (ds === todayStr) return 'Today'
  const tomorrow = new Date(todayStr + 'T00:00:00')
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (ds === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
  const past = ds < todayStr
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' }) + (past ? ' (past)' : '')
}

function fmtTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return iso }
}

export default function ChildTaskView({
  child, occurrences, completedKeys, weekEndStr, mondayStr, todayStr,
  starBalance: initialBalance, rewards, pendingRewardIds: initialPending,
  hasSpunToday, bonusCadence, bonusDay, bonusTime, maxPrize,
  streakDays, doneHistory, unseenPraises, highlightTaskId,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'tasks' | 'done'>('tasks')
  const [showPast, setShowPast] = useState(false)
  const [pulseId, setPulseId] = useState<string | null>(highlightTaskId ? `${highlightTaskId}|${todayStr}` : null)
  const [completed, setCompleted] = useState(new Set(completedKeys))
  const [starBalance, setStarBalance] = useState(initialBalance)
  const [pendingRewardIds, setPendingRewardIds] = useState(new Set(initialPending))
  const [showCelebration, setShowCelebration] = useState(false)
  const [showRewards, setShowRewards] = useState(false)
  const [showSpin, setShowSpin] = useState(false)
  const [canSpin, setCanSpin] = useState(false)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [justRequestedId, setJustRequestedId] = useState<string | null>(null)
  const [justClaimedId, setJustClaimedId] = useState<string | null>(null)
  const [claimBurst, setClaimBurst] = useState<{ stars: number; emoji: string } | null>(null)
  const [praiseQueue, setPraiseQueue] = useState<Praise[]>(unseenPraises)
  const [currentPraise, setCurrentPraise] = useState<Praise | null>(unseenPraises[0] ?? null)

  // canSpin uses LOCAL device time (avoids UTC mismatch on server)
  useEffect(() => {
    const now = new Date()
    const h = now.getHours(), m = now.getMinutes()
    const nowHHMM = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const dueToday = bonusCadence === 'daily' || now.getDay() === bonusDay
    setCanSpin(dueToday && nowHHMM >= bonusTime && !hasSpunToday)
  }, [bonusCadence, bonusDay, bonusTime, hasSpunToday])

  // Scroll to today's section on load
  useEffect(() => {
    if (tab !== 'tasks') return
    const el = document.getElementById(`date-${todayStr}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [todayStr, tab])

  // Pulse scroll to highlighted task
  useEffect(() => {
    if (!pulseId || currentPraise) return
    const el = document.getElementById(`occ-${pulseId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setPulseId(null), 2400)
    return () => clearTimeout(t)
  }, [pulseId, currentPraise])

  async function dismissPraise() {
    if (!currentPraise) return
    await createClient().from('praises').update({ seen: true }).eq('id', currentPraise.id)
    const remaining = praiseQueue.slice(1)
    setPraiseQueue(remaining)
    setCurrentPraise(remaining[0] ?? null)
  }

  // Current-week tasks for progress bar (Mon–Sun)
  const claimable = occurrences.filter(o => o.date >= mondayStr && o.date <= weekEndStr)
  const claimableDone = claimable.filter(o => completed.has(o.id)).length

  // Group by date, split into past-this-week and today-onward
  const byDate: Record<string, Occurrence[]> = {}
  occurrences.forEach(o => { (byDate[o.date] ||= []).push(o) })
  const allDates = Object.keys(byDate).sort()
  const pastDates = allDates.filter(ds => ds >= mondayStr && ds < todayStr)
  const upcomingDates = allDates.filter(ds => ds >= todayStr)

  async function completeTask(occ: Occurrence) {
    if (completed.has(occ.id) || occ.date > weekEndStr) return
    const supabase = createClient()
    const { data: completion } = await supabase.from('completions').insert({
      task_id: occ.taskId, child_id: child.id, date: occ.date, status: 'approved',
    }).select('id').single()
    await supabase.from('star_ledger').insert({
      child_id: child.id, delta: occ.star_value,
      reason: `Completed: ${occ.title}`, source_type: 'completion', source_id: completion?.id,
    })
    setJustClaimedId(occ.id)
    setTimeout(() => setJustClaimedId(null), 600)
    setClaimBurst({ stars: occ.star_value, emoji: occ.emoji })
    setTimeout(() => setClaimBurst(null), 1900)
    setStarBalance(prev => prev + occ.star_value)
    const remaining = claimable.filter(o => !completed.has(o.id) && o.id !== occ.id).length
    setCompleted(prev => new Set([...prev, occ.id]))
    if (remaining === 0) setTimeout(() => setShowCelebration(true), 700)
  }

  async function handleSpinWin(stars: number) {
    const supabase = createClient()
    const { data: spin } = await supabase.from('spin_results')
      .insert({ child_id: child.id, stars_won: stars, date: todayStr }).select('id').single()
    await supabase.from('star_ledger').insert({
      child_id: child.id, delta: stars, reason: 'Bonus spin!', source_type: 'spin', source_id: spin?.id,
    })
    setStarBalance(prev => prev + stars)
    setCanSpin(false)
  }

  async function requestReward(reward: Reward) {
    if (pendingRewardIds.has(reward.id) || starBalance < reward.star_cost) return
    setRequestingId(reward.id)
    await createClient().from('redemptions').insert({ reward_id: reward.id, child_id: child.id, status: 'requested' })
    setPendingRewardIds(prev => new Set([...prev, reward.id]))
    setJustRequestedId(reward.id)
    setTimeout(() => setJustRequestedId(null), 2000)
    setRequestingId(null)
  }

  // ── Praise overlay ──
  if (currentPraise) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 text-center z-50 bg-white">
        <div className="mb-4">
          {child.avatar_url
            ? <img src={child.avatar_url} className="w-28 h-28 rounded-3xl object-cover mx-auto" alt=""/>
            : <div className="text-8xl animate-bounce">{child.avatar}</div>}
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 max-w-xs w-full pop-in">
          <p className="text-5xl mb-3">💌</p>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">A message from your parent</p>
          <p className="text-2xl font-black text-gray-800 leading-snug mb-6">"{currentPraise.message}"</p>
          <button onClick={dismissPraise}
            className="w-full text-white font-black text-lg py-4 rounded-2xl active:scale-95 transition"
            style={{ background: `linear-gradient(135deg, ${child.colour}, #EC4899)` }}>
            {praiseQueue.length > 1 ? `Next (${praiseQueue.length - 1} more) →` : '❤️ Thanks!'}
          </button>
        </div>
      </div>
    )
  }

  // ── Celebration screen ──
  if (showCelebration) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-white">
        {CELEBRATION_EMOJIS.map((e, i) => (
          <span key={i} className="fixed text-5xl animate-bounce select-none pointer-events-none opacity-20"
            style={{ top: `${5 + i * 9}%`, left: `${5 + i * 9}%`, animationDelay: `${i * 0.15}s`, animationDuration: `${0.8 + i * 0.1}s` }}>{e}</span>
        ))}
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-4">
            {child.avatar_url
              ? <img src={child.avatar_url} className="w-28 h-28 rounded-3xl object-cover bounce-in" alt=""/>
              : <div className="text-[100px] bounce-in drop-shadow-2xl">{child.avatar}</div>}
          </div>
          <h1 className="text-4xl font-black text-gray-800 mb-1">You did it! 🎉</h1>
          <p className="text-lg text-gray-500 mb-6">{child.name.split(' ')[0]} finished this week's tasks!</p>
          <div className="bg-yellow-50 rounded-3xl px-10 py-5 mb-6 shadow-sm border border-yellow-100">
            <p className="text-5xl font-black text-yellow-500">⭐ {starBalance}</p>
            <p className="text-gray-500 text-sm mt-1 font-medium">total stars</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {canSpin && (
              <button onClick={() => setShowSpin(true)}
                className="w-full font-black text-xl py-5 rounded-3xl shadow-lg active:scale-95 transition text-white"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>🎰 Bonus Spin!</button>
            )}
            {rewards.length > 0 && (
              <button onClick={() => setShowRewards(true)}
                className="w-full font-bold py-4 rounded-2xl text-lg active:scale-95 transition border-2 text-gray-700 border-gray-200 bg-white">
                🎁 Spend Stars!
              </button>
            )}
            <button onClick={() => router.push('/dashboard')} className="text-gray-400 text-sm font-semibold py-2">
              ← Back to home
            </button>
          </div>
        </div>
        {showSpin && <SpinWheel childColour={child.colour} maxPrize={maxPrize} onWin={handleSpinWin} onClose={() => setShowSpin(false)}/>}
        {showRewards && <RewardsPanel rewards={rewards} starBalance={starBalance} pendingRewardIds={pendingRewardIds}
          requestingId={requestingId} justRequestedId={justRequestedId} onRequest={requestReward} onClose={() => setShowRewards(false)} colour={child.colour}/>}
      </div>
    )
  }

  const progress = claimable.length > 0 ? (claimableDone / claimable.length) * 100 : 0

  function renderTaskRow(occ: Occurrence) {
    const done = completed.has(occ.id)
    const locked = occ.date > weekEndStr
    const isPast = occ.date < todayStr
    const isFutureThisWeek = occ.date > todayStr && !locked
    const notYetAvailable = isFutureThisWeek && !occ.canDoEarly
    const expired = isPast && !done && !locked
    return (
      <div key={occ.id} id={`occ-${occ.id}`}
        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300
          ${done ? 'bg-gray-50 border-gray-100 opacity-70'
            : expired ? 'bg-red-50 border-red-100'
            : locked || notYetAvailable ? 'bg-gray-50 border-gray-100 opacity-60'
            : 'bg-white border-gray-100 shadow-sm'}
          ${justClaimedId === occ.id ? 'scale-95' : ''}
          ${pulseId === occ.id ? 'bounce-in' : ''}`}
        style={pulseId === occ.id ? { boxShadow: `0 0 0 3px ${child.colour}` } : {}}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${locked || notYetAvailable ? 'grayscale opacity-40' : ''}`}
          style={{ backgroundColor: child.colour + '22' }}>
          {occ.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${done ? 'line-through text-gray-400' : expired ? 'text-red-500' : locked || notYetAvailable ? 'text-gray-400' : 'text-gray-800'}`}>
            {occ.title}
          </p>
          <p className="text-xs text-gray-400">{occ.time_of_day || 'Anytime'} · +{occ.star_value} ⭐</p>
        </div>
        {done ? (
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold flex-shrink-0 text-lg">✓</div>
        ) : locked ? (
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 flex-shrink-0">🔒</div>
        ) : notYetAvailable ? (
          <div className="flex-shrink-0 text-[11px] font-semibold text-gray-300 text-center leading-tight px-1">not<br/>yet</div>
        ) : (
          <button onClick={() => completeTask(occ)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-white font-black text-sm shadow-sm active:scale-90 transition"
            style={{ background: expired ? '#EF4444' : `linear-gradient(135deg, ${child.colour}, ${child.colour}cc)` }}>
            DONE
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-32 relative">
      {claimBurst && <ClaimBurst stars={claimBurst.stars} emoji={claimBurst.emoji} colour={child.colour}/>}

      {/* Header */}
      <div className="pt-11 pb-2.5 px-4 bg-white border-b border-gray-100">
        <div className="max-w-sm mx-auto flex items-center justify-between gap-2">
          <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto"/>
          <span className="text-2xl font-black" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {child.name.split(' ')[0]}
          </span>
          <button onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-black text-sm text-white shadow-md active:scale-95 transition"
            style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: RAINBOW }}>
            ← BACK
          </button>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 pt-4 space-y-3">

        {/* Stats row */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
          {child.avatar_url
            ? <img src={child.avatar_url} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
                style={{ border: `2px solid ${child.colour}` }} alt=""/>
            : <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ backgroundColor: child.colour + '22', border: `2px solid ${child.colour}44` }}>
                {child.avatar}
              </div>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap text-sm font-bold text-gray-700 mb-1.5">
              <span>📋 {claimableDone}/{claimable.length} this week</span>
              <span>⭐ {starBalance}</span>
              {streakDays > 0 && <span className="text-orange-500">🔥 {streakDays}d streak</span>}
            </div>
            {claimable.length > 0 && (
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress}%`, backgroundColor: child.colour }}/>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1">
          {(['tasks', 'done'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold capitalize transition ${tab === t ? 'text-white shadow' : 'text-gray-400'}`}
              style={tab === t ? { background: 'var(--theme-gradient)' } : {}}>
              {t === 'tasks' ? '📋 Tasks' : `✅ Done (${doneHistory.length})`}
            </button>
          ))}
        </div>

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            {/* Bonus spin alert */}
            {canSpin && (
              <button onClick={() => setShowSpin(true)}
                className="w-full flex items-center justify-center gap-2 text-white font-black text-base py-3 rounded-2xl shadow-sm active:scale-95 transition"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
                🎰 Bonus spin ready! Tap to play
              </button>
            )}

            {/* Past days this week — hidden by default */}
            {pastDates.length > 0 && (
              <div>
                <button onClick={() => setShowPast(p => !p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-500 active:scale-95 transition mb-2">
                  <span>⬆ Past days this week ({pastDates.length} day{pastDates.length !== 1 ? 's' : ''})</span>
                  <span className={`text-gray-300 text-lg transition-transform ${showPast ? 'rotate-90' : ''}`}>›</span>
                </button>
                {showPast && (
                  <div className="space-y-4">
                    {pastDates.map(ds => {
                      const items = sortOccs(byDate[ds])
                      return (
                        <div key={ds} id={`date-${ds}`}>
                          <p className="text-xs font-black text-red-400 mb-2 px-1">
                            {dateLabel(ds, todayStr)}
                          </p>
                          <div className="space-y-2">{items.map(renderTaskRow)}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Today + upcoming */}
            {upcomingDates.map(ds => {
              const locked = ds > weekEndStr
              const isToday = ds === todayStr
              const items = sortOccs(byDate[ds])
              return (
                <div key={ds} id={`date-${ds}`}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <p className={`text-sm font-black ${isToday ? '' : 'text-gray-600'}`}
                      style={isToday ? { color: 'var(--theme-from)' } : {}}>
                      {dateLabel(ds, todayStr)}
                    </p>
                    {locked && (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">🔒 next week</span>
                    )}
                  </div>
                  <div className="space-y-2">{items.map(renderTaskRow)}</div>
                </div>
              )
            })}

            {occurrences.length === 0 && (
              <div className="text-center py-16 px-4">
                <div className="text-6xl mb-4">🎉</div>
                <p className="text-gray-600 font-semibold">No tasks coming up!</p>
                <p className="text-gray-400 text-sm mt-1">Ask a grown-up to add some tasks.</p>
              </div>
            )}
          </div>
        )}

        {/* ── DONE TAB ── */}
        {tab === 'done' && (
          <div className="space-y-2">
            {doneHistory.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-500 font-semibold">No completed tasks yet</p>
                <p className="text-gray-400 text-sm mt-1">Complete some tasks to see them here!</p>
              </div>
            ) : (
              doneHistory.map(item => (
                <div key={item.key + item.createdAt}
                  className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: child.colour + '22' }}>
                    {item.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{item.title}</p>
                    <p className="text-xs text-gray-400">{fmtTimestamp(item.createdAt)}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-black text-yellow-500">+{item.starValue} ⭐</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 px-4 pb-6 pt-3">
        <div className="max-w-sm mx-auto flex items-center gap-3">
          {rewards.length > 0 && (
            <button onClick={() => setShowRewards(true)}
              className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-2xl shadow-sm active:scale-95 transition"
              style={{ background: 'linear-gradient(135deg, #EC4899, #F97316)' }}>
              🎁 Spend Stars
            </button>
          )}
          {canSpin && (
            <button onClick={() => setShowSpin(true)}
              className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-2xl shadow-sm active:scale-95 transition"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
              🎰 Spin!
            </button>
          )}
        </div>
      </div>

      {showRewards && (
        <RewardsPanel rewards={rewards} starBalance={starBalance} pendingRewardIds={pendingRewardIds}
          requestingId={requestingId} justRequestedId={justRequestedId}
          onRequest={requestReward} onClose={() => setShowRewards(false)} colour={child.colour}/>
      )}
      {showSpin && (
        <SpinWheel childColour={child.colour} maxPrize={maxPrize}
          onWin={handleSpinWin} onClose={() => setShowSpin(false)}/>
      )}
    </div>
  )
}

function RewardsPanel({ rewards, starBalance, pendingRewardIds, requestingId, justRequestedId, onRequest, onClose, colour }: {
  rewards: Reward[]; starBalance: number; pendingRewardIds: Set<string>
  requestingId: string | null; justRequestedId: string | null
  onRequest: (r: Reward) => void; onClose: () => void; colour: string
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4"/>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black text-gray-800">🎁 Spend Your Stars</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl font-bold w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-full px-4 py-2 mb-4">
          <span className="text-yellow-400 text-xl">⭐</span>
          <span className="font-black text-gray-700">You have {starBalance} stars</span>
        </div>
        <div className="space-y-3">
          {rewards.map(reward => {
            const canAfford = starBalance >= reward.star_cost
            const isPending = pendingRewardIds.has(reward.id)
            const justDone = justRequestedId === reward.id
            return (
              <div key={reward.id}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition ${isPending ? 'border-green-200 bg-green-50' : canAfford ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-55'}`}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: colour + '22' }}>{reward.emoji}</div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{reward.title}</p>
                  <p className="text-sm text-yellow-500 font-bold">⭐ {reward.star_cost}</p>
                  {!canAfford && !isPending && <p className="text-xs text-gray-400">Need {reward.star_cost - starBalance} more ⭐</p>}
                </div>
                <button onClick={() => !isPending && canAfford && onRequest(reward)}
                  disabled={!canAfford || isPending || requestingId === reward.id}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition active:scale-95 ${isPending ? 'bg-green-100 text-green-600' : canAfford ? 'text-white shadow' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  style={canAfford && !isPending ? { background: `linear-gradient(135deg, #EC4899, #F97316)` } : {}}>
                  {justDone ? '✓ Done!' : isPending ? '⏳ Waiting' : canAfford ? 'Redeem' : "Can't afford"}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ClaimBurst({ stars, emoji, colour }: { stars: number; emoji: string; colour: string }) {
  const colors = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#EC4899', colour]
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    left: Math.random() * 100, bg: colors[i % colors.length],
    dur: 1.0 + Math.random() * 1.0, delay: Math.random() * 0.2, rot: Math.random() * 360,
  }))
  return (
    <div className="fixed inset-0 z-[55] pointer-events-none flex items-center justify-center overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece"
          style={{ left: `${p.left}%`, backgroundColor: p.bg, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }}/>
      ))}
      <div className="claim-pop bg-white rounded-3xl px-8 py-6 shadow-2xl text-center">
        <div className="text-6xl mb-1">{emoji}</div>
        <p className="text-3xl font-black text-yellow-500">+{stars} ⭐</p>
        <p className="text-sm font-bold text-gray-500 mt-1">Nice one! 🎉</p>
      </div>
    </div>
  )
}
