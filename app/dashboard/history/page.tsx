'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Completion {
  id: string
  date: string
  status: string
  child_id: string
  task_id: string
  created_at: string
  tasks: { title: string; emoji: string; star_value: number }
  children: { name: string; avatar: string; colour: string }
}

export default function HistoryPage() {
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)
  const [undoing, setUndoing] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: guardian } = await supabase
      .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return

    const { data: children } = await supabase
      .from('children').select('id').eq('family_id', guardian.family_id)
    const childIds = children?.map(c => c.id) || []

    const { data } = await supabase
      .from('completions')
      .select('id, date, status, child_id, task_id, created_at, tasks(title, emoji, star_value), children(name, avatar, colour)')
      .in('child_id', childIds.length ? childIds : ['none'])
      .order('created_at', { ascending: false })
      .limit(150)

    setCompletions((data as any) || [])
    setLoading(false)
  }

  async function undoCompletion(c: Completion) {
    if (!confirm(`Undo "${c.tasks?.title}" for ${c.children?.name}? This will remove the stars.`)) return
    setUndoing(c.id)
    const supabase = createClient()
    await supabase.from('completions').delete().eq('id', c.id)
    await supabase.from('star_ledger').insert({
      child_id: c.child_id,
      delta: -(c.tasks?.star_value || 0),
      reason: `Undo: ${c.tasks?.title}`,
      source_type: 'undo',
    })
    setUndoing(null)
    loadData()
  }

  // Group by date
  const grouped: Record<string, Completion[]> = {}
  completions.forEach(c => {
    const d = c.date
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(c)
  })
  const dates = Object.keys(grouped).sort().reverse()

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (iso === today) return 'Today'
    if (iso === yesterday) return 'Yesterday'
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-bounce">📋</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="pt-12 pb-8 px-4 bg-gradient-to-br from-indigo-500 to-purple-600">
        <div className="max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-white">Completion History</h1>
          <p className="text-indigo-200 text-sm">{completions.length} tasks completed</p>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-5">
        {dates.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-500 font-medium">No completions yet</p>
          </div>
        )}

        {dates.map(date => (
          <div key={date}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{formatDate(date)}</p>
            <div className="space-y-2">
              {grouped[date].map(c => (
                <div key={c.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[26px] leading-none overflow-hidden bg-white flex-shrink-0"
                    style={{ border: `2px solid ${c.children?.colour || '#e5e7eb'}` }}>
                    {c.children?.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{c.tasks?.emoji}</span>
                      <p className="font-semibold text-gray-800 text-sm truncate">{c.tasks?.title}</p>
                    </div>
                    <p className="text-xs text-gray-400">{c.children?.name} · <span className="text-yellow-500 font-semibold">+{c.tasks?.star_value} ⭐</span></p>
                  </div>
                  <button onClick={() => undoCompletion(c)} disabled={undoing === c.id}
                    className="text-xs text-gray-300 hover:text-red-400 font-semibold transition px-2 py-1 rounded-lg hover:bg-red-50 flex-shrink-0">
                    {undoing === c.id ? '...' : 'Undo'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
