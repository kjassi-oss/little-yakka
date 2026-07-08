'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SpinWheel from '@/components/SpinWheel'
import { completionFeedback, redeemFeedback } from '@/lib/feedback'
import DecoratedAvatar from '@/components/DecoratedAvatar'
import StarJar from '@/components/StarJar'
import TrophyShelf from '@/components/TrophyShelf'
import UpcomingTaskList, { type UChild, type UComp } from '@/components/UpcomingTaskList'

interface Child {
  id: string; name: string; avatar: string; colour: string; avatar_url?: string
  goal_title?: string | null; goal_emoji?: string | null; goal_target?: number | null
  equipped_hat?: string | null; equipped_frame?: string | null
}
interface Reward { id: string; title: string; emoji: string; star_cost: number }
interface Praise { id: string; message: string }
interface DoneItem { key: string; date: string; createdAt: string; title: string; emoji: string; starValue: number }
interface MyReward { id: string; title: string; emoji: string; cost: number; date: string; before: number | null; after: number | null }

interface Props {
  child: Child
  tasks: any[]
  assignments: Record<string, string[]>
  windowComps: UComp[]
  ufgClaims: UComp[]
  claimableTotal: number
  claimableDoneInit: number
  weekEndStr: string
  mondayStr: string
  todayStr: string
  starBalance: number
  rewards: Reward[]
  pendingRewardIds: string[]
  hasSpunToday: boolean
  bonusCadence: 'weekly' | 'monthly'
  bonusDay: number
  bonusTime: string
  maxPrize: number
  streakDays: number
  doneHistory: DoneItem[]
  unseenPraises: Praise[]
  highlightTaskId?: string | null
  autoSpin?: boolean
  totalCompletions: number
  unlockedIds: string[]
  myRewards: MyReward[]
}

const RAINBOW = 'var(--theme-gradient)'
const CELEBRATION_EMOJIS = ['⭐','🎉','✨','🌟','🎊','💫','🏆','🥳','🎈','🌈']

// 12 random cheers shown when a task is completed
const CHEERS = [
  'Whoooo whooooooo! 🥳',
  'Great work, little one! 🌟',
  'Clap clap clap! 👏👏👏',
  'Fireworks for YOU! 🎆',
  'You absolute legend! 🏆',
  'Keep up the great work! 💪',
  'Superstar move! ⭐',
  'High five! ✋',
  'BOOM! Nailed it! 💥',
  "You're on fire! 🔥",
  'Amazing effort! 🎈',
  'Champion work! 👑',
]

function fmtTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return iso }
}

export default function ChildTaskView({
  child, tasks, assignments, windowComps, ufgClaims, claimableTotal, claimableDoneInit,
  weekEndStr, mondayStr, todayStr,
  starBalance: initialBalance, rewards, pendingRewardIds: initialPending,
  hasSpunToday, bonusCadence, bonusDay, bonusTime, maxPrize,
  streakDays, doneHistory, unseenPraises, highlightTaskId, autoSpin,
  totalCompletions, unlockedIds, myRewards,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'tasks' | 'done' | 'rewards'>('tasks')
  // Local copies so the Done tab and My Rewards update live as the kid taps
  const [doneList, setDoneList] = useState<DoneItem[]>(doneHistory)
  const [myRewardsList, setMyRewardsList] = useState<MyReward[]>(myRewards)
  const [pulseId, setPulseId] = useState<string | null>(highlightTaskId ? `${highlightTaskId}|${todayStr}` : null)
  const [pendingUndo, setPendingUndo] = useState<{ task: any; comp: UComp } | null>(null)
  const [comps, setComps] = useState<UComp[]>(windowComps)
  const [ufgClaimsState, setUfgClaimsState] = useState<UComp[]>(ufgClaims)
  const [claimableDone, setClaimableDone] = useState(claimableDoneInit)
  const [starBalance, setStarBalance] = useState(initialBalance)
  const [pendingRewardIds, setPendingRewardIds] = useState(new Set(initialPending))
  const [showCelebration, setShowCelebration] = useState(false)
  const [showRewards, setShowRewards] = useState(false)
  const [showSpin, setShowSpin] = useState(false)
  const [canSpin, setCanSpin] = useState(false)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [justRequestedId, setJustRequestedId] = useState<string | null>(null)
  const [claimBurst, setClaimBurst] = useState<{ emoji: string; title: string; sub: string } | null>(null)
  const [praiseQueue, setPraiseQueue] = useState<Praise[]>(unseenPraises)
  const [currentPraise, setCurrentPraise] = useState<Praise | null>(unseenPraises[0] ?? null)

  // canSpin uses LOCAL device time (avoids UTC mismatch on server)
  useEffect(() => {
    const now = new Date()
    const h = now.getHours(), m = now.getMinutes()
    const nowHHMM = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    if (bonusCadence === 'monthly') {
      if (now.getDate() < bonusDay) start.setMonth(start.getMonth() - 1)
      start.setDate(bonusDay)
    } else {
      start.setDate(start.getDate() - ((now.getDay() - bonusDay + 7) % 7))
    }
    const onStartDay = now.toDateString() === start.toDateString()
    const withinWindow = now.getTime() < start.getTime() + 3 * 24 * 3600 * 1000 && (!onStartDay || nowHHMM >= bonusTime)
    const eligible = withinWindow && !hasSpunToday
    setCanSpin(eligible)
    // Deep-link from the home "SPIN READY" badge opens the wheel straight away
    if (eligible && autoSpin) setShowSpin(true)
  }, [bonusCadence, bonusDay, bonusTime, hasSpunToday, autoSpin])

  function scrollToToday() {
    const el = document.getElementById(`up-${todayStr}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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

  // Single-child data for the shared UpcomingTaskList
  const childU: UChild = { id: child.id, name: child.name, avatar: child.avatar, colour: child.colour, avatar_url: child.avatar_url }
  const childrenList = [childU]
  const childMap = { [child.id]: childU }
  const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000)
  // Starts at today (like the Tasks page); "Load earlier days" reveals past days. Horizon ≈ 2 weeks past the current week
  const [pastWindow, setPastWindow] = useState(0)
  const daysAhead = Math.max(0, dayDiff(todayStr, weekEndStr) + 14)
  const noop = () => {}

  // Completing a task — inserts the completion + stars, fires the confetti burst,
  // updates optimistic state, and pops the "all done!" celebration when the week's
  // claimable tasks are all ticked. (up-for-grabs bounties don't count toward the week.)
  async function handleComplete(task: any, _childId: string, ds: string) {
    if (ds > weekEndStr) return // next-week tasks are locked
    if (comps.some(c => c.task_id === task.id && c.date === ds && c.child_id === child.id)) return
    const isUfg = !!task.up_for_grabs
    if (ds < todayStr && !(task.carry_over ?? true) && !isUfg) return // missed, non-carry-over
    completionFeedback()
    const supabase = createClient()
    const { data: completion } = await supabase.from('completions').insert({
      task_id: task.id, child_id: child.id, date: ds, status: 'approved',
    }).select('id').single()
    await supabase.from('star_ledger').insert({
      child_id: child.id, delta: task.star_value,
      reason: `Completed: ${task.title}`, source_type: 'completion', source_id: completion?.id,
    })
    // Nudge the family's subscribed devices (fire-and-forget)
    fetch('/api/push/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '⭐ Task done!', body: `${child.name.split(' ')[0]} finished "${task.title}" (+${task.star_value} ⭐)` }),
    }).catch(() => {})
    setClaimBurst({
      emoji: task.emoji,
      title: CHEERS[Math.floor(Math.random() * CHEERS.length)],
      sub: `+${task.star_value} ⭐`,
    })
    setTimeout(() => setClaimBurst(null), 2200)
    setStarBalance(prev => prev + task.star_value)
    setDoneList(prev => [{
      key: `${task.id}|${ds}`, date: ds, createdAt: new Date().toISOString(),
      title: task.title, emoji: task.emoji, starValue: task.star_value,
    }, ...prev])
    const newComp: UComp = { id: (completion?.id as string) ?? `tmp-${task.id}-${ds}`, task_id: task.id, child_id: child.id, date: ds }
    setComps(prev => [...prev, newComp])
    if (isUfg) setUfgClaimsState(prev => [...prev, newComp])
    if (!isUfg && ds >= mondayStr && ds <= weekEndStr) {
      setClaimableDone(prev => {
        const next = prev + 1
        if (next >= claimableTotal && claimableTotal > 0) setTimeout(() => setShowCelebration(true), 700)
        return next
      })
    }
  }

  // UpcomingTaskList calls this when a ✓ is tapped — open the themed confirm modal.
  function handleUndoRequest(comp: UComp, task: any) {
    setPendingUndo({ task, comp })
  }

  // Kids can undo their own tick (removes the completion + the stars).
  async function confirmUndo() {
    if (!pendingUndo) return
    const { task, comp } = pendingUndo
    setPendingUndo(null)
    const supabase = createClient()
    if (comp.id && !String(comp.id).startsWith('tmp-')) {
      await supabase.from('completions').delete().eq('id', comp.id)
    } else {
      await supabase.from('completions').delete()
        .eq('task_id', task.id).eq('child_id', child.id).eq('date', comp.date)
    }
    await supabase.from('star_ledger').insert({
      child_id: child.id, delta: -task.star_value,
      reason: `Undo: ${task.title}`, source_type: 'undo',
    })
    setComps(prev => prev.filter(c => !(c.task_id === task.id && c.date === comp.date && c.child_id === child.id)))
    setUfgClaimsState(prev => prev.filter(c => !(c.task_id === task.id && c.date === comp.date && c.child_id === child.id)))
    setStarBalance(prev => prev - task.star_value)
    setDoneList(prev => {
      const idx = prev.findIndex(d => d.key === `${task.id}|${comp.date}`)
      if (idx === -1) return prev
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
    if (!task.up_for_grabs && comp.date >= mondayStr && comp.date <= weekEndStr) {
      setClaimableDone(prev => Math.max(0, prev - 1))
    }
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

  // Redeem immediately: stars come off now, and it lands in My Rewards + the
  // parents' Redeemed tab straight away (the old "waiting for approval" state
  // was invisible to parents since approvals were removed).
  async function requestReward(reward: Reward) {
    if (requestingId || starBalance < reward.star_cost) return
    redeemFeedback()
    setRequestingId(reward.id)
    const supabase = createClient()
    const { data: redemption } = await supabase.from('redemptions')
      .insert({ reward_id: reward.id, child_id: child.id, status: 'approved' }).select('id').single()
    await supabase.from('star_ledger').insert({
      child_id: child.id, delta: -reward.star_cost,
      reason: `Redeemed: ${reward.title}`, source_type: 'redemption', source_id: redemption?.id,
    })
    fetch('/api/push/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '🎁 Reward redeemed!', body: `${child.name.split(' ')[0]} redeemed "${reward.title}" (−${reward.star_cost} ⭐)` }),
    }).catch(() => {})
    setMyRewardsList(prev => [{
      id: redemption?.id || String(Date.now()), title: reward.title, emoji: reward.emoji,
      cost: reward.star_cost, date: new Date().toISOString(),
      before: starBalance, after: starBalance - reward.star_cost,
    }, ...prev])
    setStarBalance(prev => prev - reward.star_cost)
    // Reward celebration 🎉
    setClaimBurst({ emoji: reward.emoji, title: 'Woohoo! Enjoy it! 🥳', sub: `${reward.title} · −${reward.star_cost} ⭐` })
    setTimeout(() => setClaimBurst(null), 2400)
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
            style={{ background: 'var(--theme-gradient)' }}>
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
                style={{ background: 'var(--theme-gradient)' }}>🎰 Bonus Spin!</button>
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
        {showSpin && <SpinWheel childColour={child.colour} childAvatar={child.avatar} childAvatarUrl={child.avatar_url} maxPrize={maxPrize} onWin={handleSpinWin} onClose={() => setShowSpin(false)}/>}
        {showRewards && <RewardsPanel rewards={rewards} starBalance={starBalance} pendingRewardIds={pendingRewardIds}
          requestingId={requestingId} justRequestedId={justRequestedId} onRequest={requestReward} onClose={() => setShowRewards(false)} colour={child.colour}/>}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32 relative bg-gray-50">
      {claimBurst && <ClaimBurst emoji={claimBurst.emoji} title={claimBurst.title} sub={claimBurst.sub} colour={child.colour}/>}

      {/* Header — logo, child name and BACK stay pinned to the top */}
      <div className="sticky top-0 z-30 pt-11 pb-2.5 px-4 bg-white border-b border-gray-100">
        <div className="max-w-sm mx-auto flex items-center justify-between gap-2">
          <img src="/logo.png" alt="Little Yakka" className="h-12 w-auto flex-shrink-0"/>
          <span className="flex-1 min-w-0 truncate text-2xl font-black leading-none text-center" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {child.name.split(' ')[0]}
          </span>
          <button onClick={() => router.push('/dashboard')}
            className="flex-shrink-0 px-3.5 py-2.5 rounded-2xl font-black text-sm text-white shadow-md active:scale-95 transition"
            style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: RAINBOW }}>
            ← BACK
          </button>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 pt-3 space-y-3 relative z-10">

        {/* Stats row — thumbnail + stars/tasks/streak, then jar, then compact 4×3 trophies */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5">
          <div className="flex-shrink-0">
            <DecoratedAvatar child={child} size={48}/>
          </div>
          <div className="flex-shrink-0 min-w-0">
            <p className="text-xl font-black text-yellow-500 leading-none">⭐ {starBalance}</p>
            <p className="text-xs font-bold text-gray-600 mt-1">📋 {claimableDone}/{claimableTotal}</p>
            {streakDays > 0 && <p className="text-xs font-bold text-orange-500 mt-0.5">🔥 {streakDays}d streak</p>}
          </div>
          <div className="flex-shrink-0">
            <StarJar done={claimableDone} total={claimableTotal} size={38}/>
          </div>
          <div className="flex-1 min-w-0">
            <TrophyShelf compact stars={starBalance} streak={streakDays} completions={totalCompletions}/>
          </div>
        </div>

        {/* Savings goal jar */}
        {!!child.goal_target && child.goal_target > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
            <StarJar done={starBalance} total={child.goal_target} size={50}/>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Saving up for</p>
              <p className="font-black text-gray-800 truncate">{child.goal_emoji || '🎁'} {child.goal_title || 'My goal'}</p>
              <p className="text-xs font-semibold text-gray-400">⭐ {starBalance} / {child.goal_target}</p>
              {starBalance >= child.goal_target && (
                <p className="text-xs font-black text-green-500 mt-0.5 animate-pulse">🎉 GOAL REACHED — tell a grown-up!</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs — stay locked under the header while the list scrolls */}
        <div className="sticky top-[96px] z-20 -mx-4 px-4 pt-2 pb-1.5 bg-gray-50">
          <div className="flex bg-gray-100 rounded-2xl p-1">
            {(['tasks', 'done', 'rewards'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${tab === t ? 'text-white shadow' : 'text-gray-400'}`}
                style={tab === t ? { background: 'var(--theme-gradient)' } : {}}>
                {t === 'tasks' ? '📋 Tasks' : t === 'done' ? `✅ Done (${doneList.length})` : `🎁 My Rewards`}
              </button>
            ))}
          </div>
        </div>

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            {/* Bonus spin alert */}
            {canSpin && (
              <button onClick={() => setShowSpin(true)}
                className="w-full flex items-center justify-center gap-2 text-white font-black text-base py-3 rounded-2xl shadow-sm active:scale-95 transition"
                style={{ background: 'var(--theme-gradient)' }}>
                🎰 Bonus spin ready! Tap to play
              </button>
            )}

            <UpcomingTaskList
              tasks={tasks}
              childrenList={childrenList}
              childMap={childMap}
              assignments={assignments}
              windowComps={comps}
              ufgClaims={ufgClaimsState}
              upcomingFilter={new Set()}
              setUpcomingFilter={noop}
              toggleUpcomingChild={noop}
              pastWindow={pastWindow}
              setPastWindow={setPastWindow}
              daysAhead={daysAhead}
              showChildFilter={false}
              showPastWindow={true}
              showUpForGrabs={true}
              singleChildId={child.id}
              lockAfter={weekEndStr}
              highlightKey={pulseId}
              onOpenTask={noop}
              onComplete={handleComplete}
              onUndo={handleUndoRequest}
            />
          </div>
        )}

        {/* ── DONE TAB ── */}
        {tab === 'done' && (
          <div className="space-y-2">
            {doneList.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-500 font-semibold">No completed tasks yet</p>
                <p className="text-gray-400 text-sm mt-1">Complete some tasks to see them here!</p>
              </div>
            ) : (
              doneList.map(item => (
                <div key={item.key + item.createdAt}
                  className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-white"
                    style={{ border: '1.5px solid var(--theme-from)' }}>
                    {item.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-gray-800 truncate">{item.title}</p>
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

        {/* ── MY REWARDS TAB ── */}
        {tab === 'rewards' && (
          <div className="space-y-2">
            {myRewardsList.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">🎁</div>
                <p className="text-gray-500 font-semibold">No rewards redeemed yet</p>
                <p className="text-gray-400 text-sm mt-1">Save up your stars and treat yourself!</p>
              </div>
            ) : (
              myRewardsList.map(r => (
                <div key={r.id + r.date}
                  className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-white"
                    style={{ border: '1.5px solid var(--theme-from)' }}>
                    {r.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-gray-400">{fmtTimestamp(r.date)}</p>
                    {r.before !== null && r.after !== null && (
                      <p className="text-xs font-semibold text-gray-500 mt-0.5">⭐ {r.before} → {r.after}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-black text-red-400">−{r.cost} ⭐</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 px-4 pb-6 pt-3 z-10"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-sm mx-auto flex items-center gap-3">
          {rewards.length > 0 && (
            <button onClick={() => setShowRewards(true)}
              className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-2xl shadow-sm active:scale-95 transition"
              style={{ background: 'var(--theme-gradient)' }}>
              🎁 Spend Stars
            </button>
          )}
          {canSpin && (
            <button onClick={() => setShowSpin(true)}
              className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-2xl shadow-sm active:scale-95 transition"
              style={{ background: 'var(--theme-gradient)' }}>
              🎰 Spin!
            </button>
          )}
        </div>
      </div>

      {/* Jump-back-to-today FAB — little calendar showing today's date */}
      {tab === 'tasks' && (
        <button aria-label="Back to today" onClick={scrollToToday}
          className="fixed bottom-24 left-5 w-14 h-14 rounded-full bg-white shadow-xl border-2 flex flex-col items-center justify-center active:scale-90 transition z-20"
          style={{ borderColor: 'var(--theme-from)' }}>
          <span suppressHydrationWarning className="text-[8px] font-black leading-none mt-1" style={{ color: 'var(--theme-from)' }}>{new Date().toLocaleDateString('en-AU', { month: 'short' }).toUpperCase()}</span>
          <span suppressHydrationWarning className="text-xl font-black leading-none" style={{ color: 'var(--theme-from)' }}>{new Date().getDate()}</span>
        </button>
      )}

      {/* Themed undo confirmation (replaces the browser popup) */}
      {pendingUndo && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-6" onClick={() => setPendingUndo(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl pop-in text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl bg-white"
              style={{ border: '2px solid var(--theme-from)' }}>{pendingUndo.task.emoji}</div>
            <h3 className="text-xl font-black text-gray-800 leading-tight mb-1">Undo "{pendingUndo.task.title}"?</h3>
            <p className="text-sm font-semibold text-gray-400 mb-5">You'll give back {pendingUndo.task.star_value} ⭐</p>
            <div className="flex gap-2">
              <button onClick={() => setPendingUndo(null)}
                className="flex-1 py-3 rounded-2xl font-black text-sm text-white shadow active:scale-95 transition"
                style={{ background: 'var(--theme-gradient)' }}>
                Keep it! ✓
              </button>
              <button onClick={confirmUndo}
                className="flex-1 py-3 rounded-2xl font-black text-sm text-gray-500 border-2 border-gray-200 bg-white active:scale-95 transition">
                Undo
              </button>
            </div>
          </div>
        </div>
      )}

      {showRewards && (
        <RewardsPanel rewards={rewards} starBalance={starBalance} pendingRewardIds={pendingRewardIds}
          requestingId={requestingId} justRequestedId={justRequestedId}
          onRequest={requestReward} onClose={() => setShowRewards(false)} colour={child.colour}/>
      )}
      {showSpin && (
        <SpinWheel childColour={child.colour} childAvatar={child.avatar} childAvatarUrl={child.avatar_url} maxPrize={maxPrize}
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
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-white"
                  style={{ border: '1.5px solid var(--theme-from)' }}>{reward.emoji}</div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{reward.title}</p>
                  <p className="text-sm text-yellow-500 font-bold">⭐ {reward.star_cost}</p>
                  {!canAfford && !isPending && <p className="text-xs text-gray-400">Need {reward.star_cost - starBalance} more ⭐</p>}
                </div>
                <button onClick={() => !isPending && canAfford && onRequest(reward)}
                  disabled={!canAfford || isPending || requestingId === reward.id}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition active:scale-95 ${isPending ? 'bg-green-100 text-green-600' : canAfford ? 'text-white shadow' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  style={canAfford && !isPending ? { background: 'var(--theme-gradient)' } : {}}>
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

function ClaimBurst({ emoji, colour, title, sub }: { emoji: string; colour: string; title: string; sub: string }) {
  const colors = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#EC4899', '#F97316', '#22C55E', colour]
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    left: Math.random() * 100, bg: colors[i % colors.length],
    dur: 0.9 + Math.random() * 1.3, delay: Math.random() * 0.35, rot: Math.random() * 360,
  }))
  const emojiRain = ['🎉', '⭐', '🎆', '👏', '✨', '🎊', '🌟', '🥳', '🎈', '💫'].map((e, i) => ({
    e, left: 5 + Math.random() * 90, dur: 1.2 + Math.random() * 1.2, delay: Math.random() * 0.4, size: 18 + Math.random() * 14, key: i,
  }))
  return (
    <div className="fixed inset-0 z-[55] pointer-events-none flex items-center justify-center overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece"
          style={{ left: `${p.left}%`, backgroundColor: p.bg, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }}/>
      ))}
      {emojiRain.map(p => (
        <span key={`e${p.key}`} className="confetti-piece"
          style={{ left: `${p.left}%`, backgroundColor: 'transparent', fontSize: p.size, width: 'auto', height: 'auto',
            animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}>{p.e}</span>
      ))}
      <div className="claim-pop bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-[85%]">
        <div className="text-6xl mb-1">{emoji}</div>
        <p className="text-2xl font-black leading-tight" style={{ color: 'var(--theme-from)' }}>{title}</p>
        <p className="text-xl font-black text-yellow-500 mt-1">{sub}</p>
      </div>
    </div>
  )
}
