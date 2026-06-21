'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PinModal from '@/components/PinModal'

interface Task {
  id: string; title: string; emoji: string; type: string
  time_of_day: string | null; star_value: number; requires_photo: boolean
}
interface Child { id: string; name: string; avatar: string; colour: string }
interface Reward { id: string; title: string; emoji: string; star_cost: number }
interface Props {
  child: Child; tasks: Task[]; completedTaskIds: string[]
  starBalance: number; parentPin: string; rewards: Reward[]; pendingRewardIds: string[]
}

const ENCOURAGEMENTS = [
  '⭐ Amazing!', '🔥 On fire!', '💪 Keep going!', '🏆 Champion!',
  '🎉 Brilliant!', '🦁 You legend!', '🌟 Superstar!', '🎈 Awesome!',
  '🚀 Crushing it!', '💡 So smart!', '🥳 Way to go!', '🤩 Unreal!',
]

const CELEBRATION_EMOJIS = ['⭐','🎉','✨','🌟','🎊','💫','🏆','🥳','🎈','🌈']

interface FloatingBadge { id: number; value: number; top: number }

export default function ChildTaskView({
  child, tasks, completedTaskIds: initial, starBalance: initialBalance,
  parentPin, rewards, pendingRewardIds: initialPending,
}: Props) {
  const router = useRouter()
  const [completedIds, setCompletedIds] = useState(new Set(initial))
  const [starBalance, setStarBalance] = useState(initialBalance)
  const [pendingRewardIds, setPendingRewardIds] = useState(new Set(initialPending))
  const [showPin, setShowPin] = useState(false)
  const [showExitSummary, setShowExitSummary] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showRewards, setShowRewards] = useState(false)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [justRequestedId, setJustRequestedId] = useState<string | null>(null)
  const [floatingBadges, setFloatingBadges] = useState<FloatingBadge[]>([])
  const [encouragement, setEncouragement] = useState<string | null>(null)
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null)
  const sessionCompleted = useRef(new Set<string>())

  const incomplete = tasks.filter(t => !completedIds.has(t.id))
  const complete = tasks.filter(t => completedIds.has(t.id))

  async function completeTask(task: Task) {
    if (completedIds.has(task.id)) return
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: completion } = await supabase.from('completions').insert({
      task_id: task.id, child_id: child.id, date: today, status: 'approved',
    }).select('id').single()

    await supabase.from('star_ledger').insert({
      child_id: child.id, delta: task.star_value,
      reason: `Completed: ${task.title}`, source_type: 'completion',
      source_id: completion?.id,
    })

    sessionCompleted.current.add(task.id)
    setJustCompletedId(task.id)
    setTimeout(() => setJustCompletedId(null), 600)

    const badgeId = Date.now()
    const topPct = 30 + Math.random() * 20
    setFloatingBadges(prev => [...prev, { id: badgeId, value: task.star_value, top: topPct }])
    setTimeout(() => setFloatingBadges(prev => prev.filter(b => b.id !== badgeId)), 1500)

    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
    setEncouragement(msg)
    setTimeout(() => setEncouragement(null), 1800)

    setCompletedIds(prev => new Set([...prev, task.id]))
    setStarBalance(prev => prev + task.star_value)

    if (incomplete.length === 1) setTimeout(() => setShowCelebration(true), 700)
  }

  async function requestReward(reward: Reward) {
    if (pendingRewardIds.has(reward.id) || starBalance < reward.star_cost) return
    setRequestingId(reward.id)
    const supabase = createClient()
    await supabase.from('redemptions').insert({ reward_id: reward.id, child_id: child.id, status: 'requested' })
    setPendingRewardIds(prev => new Set([...prev, reward.id]))
    setJustRequestedId(reward.id)
    setTimeout(() => setJustRequestedId(null), 2000)
    setRequestingId(null)
  }

  function handleExit() {
    if (sessionCompleted.current.size === 0) {
      router.push('/dashboard')
    } else {
      setShowExitSummary(true)
    }
  }

  async function checkParentPin(pin: string) { return pin === parentPin }

  if (showCelebration) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${child.colour}, ${child.colour}bb)` }}>
        {/* Background floating emojis */}
        {CELEBRATION_EMOJIS.map((e, i) => (
          <span key={i} className="fixed text-5xl animate-bounce select-none pointer-events-none opacity-25"
            style={{
              top: `${5 + (i * 9)}%`,
              left: `${5 + (i * 9)}%`,
              animationDelay: `${i * 0.15}s`,
              animationDuration: `${0.8 + i * 0.1}s`,
            }}>
            {e}
          </span>
        ))}
        <div className="relative z-10 flex flex-col items-center">
          <div className="text-[100px] bounce-in mb-2 drop-shadow-2xl">{child.avatar}</div>
          <h1 className="text-4xl font-black text-white drop-shadow-lg mb-1">You did it!</h1>
          <p className="text-xl text-white/90 mb-8">{child.name} finished everything! 🎉</p>
          <div className="bg-white rounded-3xl px-10 py-5 mb-6 shadow-2xl pop-in">
            <p className="text-5xl font-black text-yellow-500">⭐ {starBalance}</p>
            <p className="text-gray-500 text-sm mt-1 font-medium">total stars</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {rewards.length > 0 && (
              <button onClick={() => setShowRewards(true)}
                className="w-full bg-white/25 border-2 border-white text-white font-bold py-4 rounded-2xl text-lg active:scale-95 transition">
                🎁 Spend Stars!
              </button>
            )}
            <button onClick={handleExit}
              className="text-white/80 text-sm font-semibold py-2 hover:text-white transition">
              Exit Kid Mode →
            </button>
          </div>
        </div>

        {showExitSummary && (
          <ExitSummary tasks={tasks.filter(t => sessionCompleted.current.has(t.id))}
            onConfirm={() => { setShowExitSummary(false); setShowPin(true) }}
            onCancel={() => setShowExitSummary(false)}/>
        )}
        {showPin && (
          <PinModal title="Exit Kid Mode" onSuccess={() => router.push('/dashboard')}
            onCancel={() => setShowPin(false)} checkPin={checkParentPin}/>
        )}
        {showRewards && (
          <RewardsPanel rewards={rewards} starBalance={starBalance} pendingRewardIds={pendingRewardIds}
            requestingId={requestingId} justRequestedId={justRequestedId}
            onRequest={requestReward} onClose={() => setShowRewards(false)} colour={child.colour}/>
        )}
      </div>
    )
  }

  const progress = tasks.length > 0 ? (complete.length / tasks.length) * 100 : 0

  return (
    <div className="min-h-screen pb-32 relative"
      style={{ background: `linear-gradient(180deg, ${child.colour}55 0%, #f9fafb 30%)` }}>

      {/* Floating "+X ⭐" badges */}
      {floatingBadges.map(badge => (
        <div key={badge.id} className="float-up text-3xl font-black drop-shadow-lg"
          style={{ top: `${badge.top}%`, color: '#FBBF24' }}>
          +{badge.value} ⭐
        </div>
      ))}

      {/* Encouragement popup */}
      {encouragement && (
        <div className="fixed top-24 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="pop-in bg-black/75 backdrop-blur text-white text-xl font-bold px-7 py-3.5 rounded-3xl shadow-2xl">
            {encouragement}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="pt-10 pb-4 px-4 text-center">
        <div className="text-7xl mb-2 drop-shadow-lg">{child.avatar}</div>
        <h1 className="text-2xl font-bold text-gray-800">{child.name}'s Tasks</h1>
        <div className="inline-flex items-center gap-2 bg-white rounded-full px-5 py-2.5 mt-2 shadow-md">
          <span className="text-yellow-400 text-xl">⭐</span>
          <span className="font-black text-gray-700 text-xl">{starBalance}</span>
          <span className="text-gray-400 text-sm">stars</span>
        </div>
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="px-5 mb-6">
          <div className="flex justify-between text-sm font-bold mb-2">
            <span className="text-gray-600">{complete.length} of {tasks.length} done</span>
            {incomplete.length > 0 ? (
              <span className="text-gray-400">{incomplete.length} to go 💪</span>
            ) : (
              <span className="text-green-500">All done! 🎉</span>
            )}
          </div>
          <div className="h-5 bg-white rounded-full overflow-hidden shadow-inner">
            <div className="h-full rounded-full transition-all duration-700 relative"
              style={{ width: `${progress}%`, backgroundColor: child.colour }}>
              {progress > 15 && (
                <span className="absolute right-2 top-0.5 text-white text-xs font-bold">{Math.round(progress)}%</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incomplete tasks */}
      <div className="px-4 space-y-3">
        {incomplete.map((task, i) => (
          <button key={task.id} onClick={() => completeTask(task)}
            className={`w-full flex items-center gap-4 p-4 bg-white rounded-3xl shadow-sm text-left transition-all duration-300 active:scale-95 ${justCompletedId === task.id ? 'scale-90 opacity-50' : ''}`}
            style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 transition-transform"
              style={{ backgroundColor: child.colour + '22' }}>
              {task.emoji}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-800 text-base">{task.title}</p>
              {task.time_of_day && <p className="text-sm text-gray-400 capitalize mt-0.5">{task.time_of_day}</p>}
            </div>
            <div className="flex-shrink-0 text-center">
              <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center"
                style={{ backgroundColor: child.colour + '22' }}>
                <p className="text-xl font-black text-yellow-500">+{task.star_value}</p>
                <p className="text-[10px] text-gray-400 font-semibold">stars</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Completed tasks */}
      {complete.length > 0 && (
        <div className="px-4 mt-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Done ✓</p>
          <div className="space-y-2">
            {complete.map(task => (
              <div key={task.id} className="flex items-center gap-4 p-4 bg-white/70 rounded-3xl opacity-55 fade-slide-up">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 grayscale">{task.emoji}</div>
                <p className="font-semibold text-gray-400 line-through text-base flex-1">{task.title}</p>
                <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-lg">✓</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-gray-600 font-semibold">No tasks assigned yet!</p>
          <p className="text-gray-400 text-sm mt-1">Ask a grown-up to add some tasks.</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-6 pt-3 bg-white/90 backdrop-blur border-t border-gray-100 shadow-lg">
        {rewards.length > 0 ? (
          <button onClick={() => setShowRewards(true)}
            className="flex items-center gap-2 text-white font-bold py-3 px-5 rounded-2xl shadow active:scale-95 transition"
            style={{ background: 'linear-gradient(135deg, #EC4899, #F97316)' }}>
            🎁 <span>Rewards</span>
          </button>
        ) : <div/>}
        <button onClick={handleExit}
          className={`rounded-2xl px-5 py-3 shadow-md font-semibold text-sm border active:scale-95 transition ${sessionCompleted.current.size > 0 ? 'text-white border-transparent' : 'bg-white text-gray-500 border-gray-100'}`}
          style={sessionCompleted.current.size > 0 ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
          {sessionCompleted.current.size > 0 ? '✅ All done!' : '🔐 Exit'}
        </button>
      </div>

      {showExitSummary && (
        <ExitSummary tasks={tasks.filter(t => sessionCompleted.current.has(t.id))}
          onConfirm={() => { setShowExitSummary(false); setShowPin(true) }}
          onCancel={() => setShowExitSummary(false)}/>
      )}
      {showPin && (
        <PinModal title="Exit Kid Mode" onSuccess={() => router.push('/dashboard')}
          onCancel={() => setShowPin(false)} checkPin={checkParentPin}/>
      )}
      {showRewards && (
        <RewardsPanel rewards={rewards} starBalance={starBalance} pendingRewardIds={pendingRewardIds}
          requestingId={requestingId} justRequestedId={justRequestedId}
          onRequest={requestReward} onClose={() => setShowRewards(false)} colour={child.colour}/>
      )}
    </div>
  )
}

function ExitSummary({ tasks, onConfirm, onCancel }: {
  tasks: Task[]; onConfirm: () => void; onCancel: () => void
}) {
  const totalStars = tasks.reduce((s, t) => s + t.star_value, 0)
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl p-6 pop-in max-h-[80vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5"/>
        <h2 className="text-xl font-black text-gray-800 mb-1">Tasks done this session 🌟</h2>
        <p className="text-gray-400 text-sm mb-4">Parent confirms these were completed</p>
        <div className="space-y-2 mb-5">
          {tasks.map(t => (
            <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50">
              <span className="text-2xl">{t.emoji}</span>
              <span className="font-semibold text-gray-700 flex-1">{t.title}</span>
              <span className="text-yellow-500 font-bold">+{t.star_value} ⭐</span>
            </div>
          ))}
        </div>
        <div className="bg-yellow-50 rounded-2xl px-4 py-3 mb-5 flex items-center justify-between">
          <span className="font-semibold text-gray-600">Total stars earned</span>
          <span className="text-2xl font-black text-yellow-500">+{totalStars} ⭐</span>
        </div>
        <button onClick={onConfirm}
          className="w-full text-white font-bold py-4 rounded-2xl text-lg active:scale-95 transition mb-3"
          style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
          Looks good! Exit 🔐
        </button>
        <button onClick={onCancel} className="w-full text-gray-400 text-sm py-2 font-semibold">
          Keep going! 💪
        </button>
      </div>
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
