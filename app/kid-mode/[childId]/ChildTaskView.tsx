'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PinModal from '@/components/PinModal'

interface Task {
  id: string
  title: string
  emoji: string
  type: string
  time_of_day: string | null
  star_value: number
  requires_photo: boolean
}

interface Child {
  id: string
  name: string
  avatar: string
  colour: string
}

interface Props {
  child: Child
  tasks: Task[]
  completedTaskIds: string[]
  starBalance: number
  parentPin: string
}

const CELEBRATION_EMOJIS = ['⭐','🎉','✨','🌟','🎊','💫','🏆','🥳']

export default function ChildTaskView({ child, tasks, completedTaskIds: initial, starBalance: initialBalance, parentPin }: Props) {
  const router = useRouter()
  const [completedIds, setCompletedIds] = useState(new Set(initial))
  const [starBalance, setStarBalance] = useState(initialBalance)
  const [showPin, setShowPin] = useState(false)
  const [justEarned, setJustEarned] = useState<number | null>(null)
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  const incomplete = tasks.filter(t => !completedIds.has(t.id))
  const complete = tasks.filter(t => completedIds.has(t.id))

  async function completeTask(task: Task) {
    if (completedIds.has(task.id)) return

    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    await supabase.from('completions').insert({
      task_id: task.id,
      child_id: child.id,
      date: today,
      status: 'approved',
    })

    await supabase.from('star_ledger').insert({
      child_id: child.id,
      delta: task.star_value,
      reason: `Completed: ${task.title}`,
      source_type: 'completion',
    })

    setJustCompletedId(task.id)
    setTimeout(() => setJustCompletedId(null), 800)

    setCompletedIds(prev => new Set([...prev, task.id]))
    setStarBalance(prev => prev + task.star_value)
    setJustEarned(task.star_value)
    setTimeout(() => setJustEarned(null), 2000)

    if (incomplete.length === 1) {
      setTimeout(() => setShowCelebration(true), 700)
    }
  }

  async function checkParentPin(pin: string): Promise<boolean> {
    return pin === parentPin
  }

  if (showCelebration) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ background: `linear-gradient(135deg, ${child.colour}, ${child.colour}99)` }}
      >
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {CELEBRATION_EMOJIS.map((e, i) => (
            <span
              key={i}
              className="text-4xl animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {e}
            </span>
          ))}
        </div>

        <div className="text-8xl mb-4">{child.avatar}</div>
        <h1 className="text-4xl font-bold text-white drop-shadow-lg mb-2">Amazing!</h1>
        <p className="text-xl text-white/90 mb-6">{child.name} finished everything! 🎉</p>

        <div className="bg-white rounded-3xl px-10 py-5 mb-8 shadow-xl">
          <p className="text-4xl font-bold text-yellow-500">⭐ {starBalance}</p>
          <p className="text-gray-500 text-sm mt-1">total stars</p>
        </div>

        <button
          onClick={() => setShowPin(true)}
          className="bg-white/20 border-2 border-white text-white font-semibold py-3 px-8 rounded-2xl hover:bg-white/30 transition"
        >
          Exit Kid Mode
        </button>

        {showPin && (
          <PinModal
            title="Exit Kid Mode"
            onSuccess={() => router.push('/dashboard')}
            onCancel={() => setShowPin(false)}
            checkPin={checkParentPin}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: `linear-gradient(180deg, ${child.colour}44 0%, #f9fafb 35%)` }}>
      {/* Header */}
      <div className="pt-10 pb-4 px-4 text-center">
        <div className="text-7xl mb-2">{child.avatar}</div>
        <h1 className="text-2xl font-bold text-gray-800">{child.name}'s Tasks</h1>

        <div className="inline-flex items-center gap-2 bg-white rounded-full px-5 py-2 mt-2 shadow-sm">
          <span className="text-yellow-400 text-xl">⭐</span>
          <span className="font-bold text-gray-700 text-lg">{starBalance}</span>
          <span className="text-gray-400 text-sm">stars</span>
          {justEarned && (
            <span className="text-green-500 font-bold animate-bounce">+{justEarned}!</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="px-4 mb-5">
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-gray-500">{complete.length}/{tasks.length} done</span>
            <span className="text-gray-400">{incomplete.length} to go</span>
          </div>
          <div className="h-4 bg-white rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(complete.length / tasks.length) * 100}%`,
                backgroundColor: child.colour,
              }}
            />
          </div>
        </div>
      )}

      {/* Incomplete tasks */}
      <div className="px-4 space-y-3">
        {incomplete.map(task => (
          <button
            key={task.id}
            onClick={() => completeTask(task)}
            className={`w-full flex items-center gap-4 p-4 bg-white rounded-3xl shadow-sm text-left transition-all duration-300 active:scale-95 ${
              justCompletedId === task.id ? 'scale-95 opacity-60' : ''
            }`}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0"
              style={{ backgroundColor: child.colour + '22' }}
            >
              {task.emoji}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-800 text-base">{task.title}</p>
              {task.time_of_day && (
                <p className="text-sm text-gray-400 capitalize mt-0.5">{task.time_of_day}</p>
              )}
            </div>
            <div className="flex-shrink-0 text-center">
              <p className="text-xl font-bold text-yellow-500">+{task.star_value}</p>
              <p className="text-xs text-gray-400">stars</p>
            </div>
          </button>
        ))}
      </div>

      {/* Completed tasks */}
      {complete.length > 0 && (
        <div className="px-4 mt-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">All done ✓</p>
          <div className="space-y-2">
            {complete.map(task => (
              <div key={task.id} className="flex items-center gap-4 p-4 bg-white/60 rounded-3xl opacity-60">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 grayscale">
                  {task.emoji}
                </div>
                <p className="font-semibold text-gray-400 line-through text-base flex-1">{task.title}</p>
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  ✓
                </div>
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

      {/* Exit button */}
      <div className="fixed bottom-8 right-5">
        <button
          onClick={() => setShowPin(true)}
          className="bg-white rounded-2xl px-4 py-2.5 shadow-md text-gray-500 text-sm font-semibold border border-gray-100 active:scale-95 transition"
        >
          🔐 Exit
        </button>
      </div>

      {showPin && (
        <PinModal
          title="Exit Kid Mode"
          onSuccess={() => router.push('/dashboard')}
          onCancel={() => setShowPin(false)}
          checkPin={checkParentPin}
        />
      )}
    </div>
  )
}
