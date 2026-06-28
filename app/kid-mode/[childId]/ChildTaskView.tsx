'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SpinWheel from '@/components/SpinWheel'

interface Occurrence { id: string; taskId: string; title: string; emoji: string; star_value: number; time_of_day: string | null; date: string }
interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string }
interface Reward { id: string; title: string; emoji: string; star_cost: number }
interface Praise { id: string; message: string }
interface Props {
  child: Child; occurrences: Occurrence[]; completedKeys: string[]
  weekEndStr: string; todayStr: string
  starBalance: number; rewards: Reward[]; pendingRewardIds: string[]
  canSpin: boolean; spinTier: 'low' | 'mid' | 'high'; bonusLabel: string
  unseenPraises: Praise[]; highlightTaskId?: string | null
}

const CELEBRATION_EMOJIS = ['⭐','🎉','✨','🌟','🎊','💫','🏆','🥳','🎈','🌈']

function dateLabel(ds: string, todayStr: string): string {
  if (ds === todayStr) return 'Today'
  const tomorrow = new Date(todayStr + 'T00:00:00'); tomorrow.setDate(tomorrow.getDate() + 1)
  if (ds === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function ChildTaskView({
  child, occurrences, completedKeys, weekEndStr, todayStr,
  starBalance: initialBalance, rewards, pendingRewardIds: initialPending,
  canSpin: initialCanSpin, spinTier, bonusLabel, unseenPraises, highlightTaskId,
}: Props) {
  const router = useRouter()
  const [pulseId, setPulseId] = useState<string | null>(highlightTaskId ? `${highlightTaskId}|${todayStr}` : null)
  const [completed, setCompleted] = useState(new Set(completedKeys))
  const [starBalance, setStarBalance] = useState(initialBalance)
  const [pendingRewardIds, setPendingRewardIds] = useState(new Set(initialPending))
  const [showCelebration, setShowCelebration] = useState(false)
  const [showRewards, setShowRewards] = useState(false)
  const [showSpin, setShowSpin] = useState(false)
  const [canSpin, setCanSpin] = useState(initialCanSpin)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [justRequestedId, setJustRequestedId] = useState<string | null>(null)
  const [justClaimedId, setJustClaimedId] = useState<string | null>(null)
  const [claimBurst, setClaimBurst] = useState<{ stars: number; emoji: string } | null>(null)
  const [praiseQueue, setPraiseQueue] = useState<Praise[]>(unseenPraises)
  const [currentPraise, setCurrentPraise] = useState<Praise | null>(unseenPraises[0] ?? null)

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

  const claimable = occurrences.filter(o => o.date <= weekEndStr)
  const claimableDone = claimable.filter(o => completed.has(o.id)).length

  // Group occurrences by date (ascending)
  const byDate: Record<string, Occurrence[]> = {}
  occurrences.forEach(o => { (byDate[o.date] ||= []).push(o) })
  const dates = Object.keys(byDate).sort()

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

  function handleExit() { router.push('/dashboard') }

  // === Praise overlay ===
  if (currentPraise) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 text-center z-50"
        style={{ background: `linear-gradient(135deg, ${child.colour}dd, ${child.colour}99)` }}>
        <div className="mb-4">{child.avatar_url ? <img src={child.avatar_url} className="w-28 h-28 rounded-3xl object-cover mx-auto" alt=""/> : <div className="text-8xl animate-bounce">{child.avatar}</div>}</div>
        <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xs w-full pop-in">
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

  // === Celebration screen ===
  if (showCelebration) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${child.colour}, ${child.colour}bb)` }}>
        {CELEBRATION_EMOJIS.map((e, i) => (
          <span key={i} className="fixed text-5xl animate-bounce select-none pointer-events-none opacity-25"
            style={{ top: `${5 + (i * 9)}%`, left: `${5 + (i * 9)}%`, animationDelay: `${i * 0.15}s`, animationDuration: `${0.8 + i * 0.1}s` }}>{e}</span>
        ))}
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-2">{child.avatar_url ? <img src={child.avatar_url} className="w-28 h-28 rounded-3xl object-cover bounce-in" alt=""/> : <div className="text-[100px] bounce-in drop-shadow-2xl">{child.avatar}</div>}</div>
          <h1 className="text-4xl font-black text-white drop-shadow-lg mb-1">You did it!</h1>
          <p className="text-xl text-white/90 mb-8">{child.name} finished this week's tasks! 🎉</p>
          <div className="bg-white rounded-3xl px-10 py-5 mb-6 shadow-2xl pop-in">
            <p className="text-5xl font-black text-yellow-500">⭐ {starBalance}</p>
            <p className="text-gray-500 text-sm mt-1 font-medium">total stars</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {canSpin && (
              <button onClick={() => setShowSpin(true)}
                className="w-full font-black text-xl py-5 rounded-3xl shadow-2xl active:scale-95 transition text-white"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>🎰 Bonus Spin!</button>
            )}
            {rewards.length > 0 && (
              <button onClick={() => setShowRewards(true)}
                className="w-full bg-white/25 border-2 border-white text-white font-bold py-4 rounded-2xl text-lg active:scale-95 transition">🎁 Spend Stars!</button>
            )}
            <button onClick={handleExit} className="text-white/80 text-sm font-semibold py-2 hover:text-white transition">Exit Kid Mode →</button>
          </div>
        </div>
        {showSpin && <SpinWheel childColour={child.colour} tier={spinTier} onWin={handleSpinWin} onClose={() => setShowSpin(false)}/>}
        {showRewards && <RewardsPanel rewards={rewards} starBalance={starBalance} pendingRewardIds={pendingRewardIds}
          requestingId={requestingId} justRequestedId={justRequestedId} onRequest={requestReward} onClose={() => setShowRewards(false)} colour={child.colour}/>}
      </div>
    )
  }

  const progress = claimable.length > 0 ? (claimableDone / claimable.length) * 100 : 0

  return (
    <div className="min-h-screen pb-32 relative" style={{ background: `linear-gradient(180deg, ${child.colour}55 0%, #f9fafb 30%)` }}>
      {claimBurst && <ClaimBurst stars={claimBurst.stars} emoji={claimBurst.emoji} colour={child.colour} />}

      {/* Header */}
      <div className="pt-10 pb-3 px-4 text-center">
        <div className="mb-2 flex justify-center">
          {child.avatar_url
            ? <img src={child.avatar_url} className="w-20 h-20 rounded-3xl object-cover drop-shadow-lg" style={{ border: `3px solid ${child.colour}` }} alt=""/>
            : <div className="text-7xl drop-shadow-lg">{child.avatar}</div>}
        </div>
        <h1 className="text-2xl font-bold text-gray-800">{child.name}'s Tasks</h1>
        <div className="inline-flex items-center gap-2 bg-white rounded-full px-5 py-2.5 mt-2 shadow-md">
          <span className="text-yellow-400 text-xl">⭐</span>
          <span className="font-black text-gray-700 text-xl">{starBalance}</span>
          <span className="text-gray-400 text-sm">stars</span>
        </div>
      </div>

      {/* This week progress */}
      {claimable.length > 0 && (
        <div className="px-5 mb-4">
          <div className="flex justify-between text-sm font-bold mb-2">
            <span className="text-gray-600">This week: {claimableDone} of {claimable.length}</span>
            {claimableDone >= claimable.length ? <span className="text-green-500">All done! 🎉</span> : <span className="text-gray-400">{claimable.length - claimableDone} to go 💪</span>}
          </div>
          <div className="h-4 bg-white rounded-full overflow-hidden shadow-inner">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: child.colour }}/>
          </div>
        </div>
      )}

      {/* Bonus spin alert */}
      {canSpin && (
        <div className="px-4 mb-4">
          <button onClick={() => setShowSpin(true)}
            className="w-full flex items-center justify-center gap-2 text-white font-black text-lg py-4 rounded-3xl shadow-lg active:scale-95 transition"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
            🎰 Bonus spin ready! Tap to play
          </button>
        </div>
      )}

      {/* Tasks by date */}
      <div className="px-4 space-y-5">
        {dates.map(ds => {
          const locked = ds > weekEndStr
          const items = byDate[ds]
          return (
            <div key={ds}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <p className="text-sm font-black text-gray-700">{dateLabel(ds, todayStr)}</p>
                {locked && <span className="text-[10px] font-bold text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">🔒 next week</span>}
                {!locked && ds !== todayStr && ds >= todayStr && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: child.colour, backgroundColor: child.colour + '22' }}>can do early ✨</span>}
              </div>
              <div className="space-y-2.5">
                {items.map(occ => {
                  const done = completed.has(occ.id)
                  return (
                    <div key={occ.id} id={`occ-${occ.id}`}
                      className={`flex items-center gap-3 p-3.5 rounded-3xl transition-all duration-300 ${done ? 'bg-white/60 opacity-60' : locked ? 'bg-white/70' : 'bg-white shadow-sm'} ${justClaimedId === occ.id ? 'scale-95' : ''} ${pulseId === occ.id ? 'bounce-in' : ''}`}
                      style={pulseId === occ.id ? { boxShadow: `0 0 0 3px ${child.colour}` } : {}}>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${done || locked ? 'grayscale' : ''}`}
                        style={{ backgroundColor: child.colour + '22' }}>{occ.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-base ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{occ.title}</p>
                        <p className="text-xs text-gray-400">{occ.time_of_day ? occ.time_of_day : 'anytime'} · +{occ.star_value} ⭐</p>
                      </div>
                      {done ? (
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-lg">✓</div>
                      ) : locked ? (
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 flex-shrink-0 text-lg">🔒</div>
                      ) : (
                        <button onClick={() => completeTask(occ)}
                          className="flex-shrink-0 px-4 py-2.5 rounded-2xl text-white font-black text-sm shadow active:scale-90 transition"
                          style={{ background: `linear-gradient(135deg, ${child.colour}, ${child.colour}cc)` }}>Claim</button>
                      )}
                    </div>
                  )
                })}
              </div>
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

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-6 pt-3 bg-white/90 backdrop-blur border-t border-gray-100 shadow-lg">
        {rewards.length > 0 ? (
          <button onClick={() => setShowRewards(true)}
            className="flex items-center gap-2 text-white font-bold py-3 px-5 rounded-2xl shadow active:scale-95 transition"
            style={{ background: 'linear-gradient(135deg, #EC4899, #F97316)' }}>🎁 <span>Rewards</span></button>
        ) : <div/>}
        <button onClick={handleExit}
          className="rounded-2xl px-5 py-3 shadow-md font-semibold text-sm bg-white text-gray-500 border border-gray-100 active:scale-95 transition">← Exit</button>
      </div>

      {showRewards && <RewardsPanel rewards={rewards} starBalance={starBalance} pendingRewardIds={pendingRewardIds}
        requestingId={requestingId} justRequestedId={justRequestedId} onRequest={requestReward} onClose={() => setShowRewards(false)} colour={child.colour}/>}
      {showSpin && <SpinWheel childColour={child.colour} tier={spinTier} onWin={handleSpinWin} onClose={() => setShowSpin(false)}/>}
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-gray-800">🎁 Spend Your Stars</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl font-bold w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="inline-flex items-center gap-2 bg-yellow-50 rounded-full px-4 py-2 mb-5">
          <span className="text-yellow-400 text-xl">⭐</span>
          <span className="font-black text-gray-700">You have {starBalance} stars</span>
        </div>
        <div className="space-y-3">
          {rewards.map(reward => {
            const canAfford = starBalance >= reward.star_cost
            const isPending = pendingRewardIds.has(reward.id)
            const justDone = justRequestedId === reward.id
            return (
              <div key={reward.id} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition ${isPending ? 'border-green-200 bg-green-50' : canAfford ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-55'}`}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: colour + '22' }}>{reward.emoji}</div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{reward.title}</p>
                  <p className="text-sm text-yellow-500 font-bold">⭐ {reward.star_cost}</p>
                  {!canAfford && !isPending && <p className="text-xs text-gray-400">Need {reward.star_cost - starBalance} more ⭐</p>}
                </div>
                <button onClick={() => !isPending && canAfford && onRequest(reward)}
                  disabled={!canAfford || isPending || requestingId === reward.id}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition active:scale-95 ${isPending ? 'bg-green-100 text-green-600' : canAfford ? 'text-white shadow' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  style={canAfford && !isPending ? { background: 'linear-gradient(135deg, #EC4899, #F97316)' } : {}}>
                  {justDone ? '✓ Sent!' : isPending ? '⏳ Waiting' : canAfford ? 'Request' : "Can't afford"}
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
