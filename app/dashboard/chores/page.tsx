'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const EMOJIS = ['🛏️','🧹','🍽️','🧺','📚','🐕','🌿','🗑️','🛁','🧼','🪥','🍳','🚿','🧽','👕']
const TIME_OPTIONS = [
  { value: 'morning', label: '🌅 Morning' },
  { value: 'afternoon', label: '☀️ Afternoon' },
  { value: 'evening', label: '🌙 Evening' },
]

interface Task {
  id: string
  title: string
  emoji: string
  type: 'chore' | 'routine'
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

export default function ChoresPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [familyId, setFamilyId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('⭐')
  const [type, setType] = useState<'chore' | 'routine'>('chore')
  const [timeOfDay, setTimeOfDay] = useState('morning')
  const [starValue, setStarValue] = useState(1)
  const [requiresPhoto, setRequiresPhoto] = useState(false)
  const [assignedChildren, setAssignedChildren] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: guardian } = await supabase
      .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return
    setFamilyId(guardian.family_id)

    const [{ data: tasksData }, { data: childrenData }, { data: assignmentsData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('family_id', guardian.family_id).order('created_at'),
      supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
      supabase.from('task_assignments').select('task_id, child_id'),
    ])

    setTasks(tasksData || [])
    setChildren(childrenData || [])

    const map: Record<string, string[]> = {}
    assignmentsData?.forEach(a => {
      if (!map[a.task_id]) map[a.task_id] = []
      map[a.task_id].push(a.child_id)
    })
    setAssignments(map)
    setPageLoading(false)
  }

  async function saveTask() {
    if (!title.trim()) { setFormError('Please enter a task name.'); return }
    if (assignedChildren.length === 0) { setFormError('Please assign this task to at least one child.'); return }
    setSaving(true)
    setFormError('')

    const supabase = createClient()
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        family_id: familyId,
        title: title.trim(),
        emoji,
        type,
        time_of_day: type === 'routine' ? timeOfDay : null,
        star_value: starValue,
        requires_photo: requiresPhoto,
        recurrence: 'daily',
      })
      .select().single()

    if (error || !task) { setFormError(error?.message || 'Failed to save.'); setSaving(false); return }

    await supabase.from('task_assignments').insert(
      assignedChildren.map(childId => ({ task_id: task.id, child_id: childId }))
    )

    setTitle(''); setEmoji('⭐'); setType('chore'); setTimeOfDay('morning')
    setStarValue(1); setRequiresPhoto(false); setAssignedChildren([])
    setShowForm(false); setSaving(false)
    loadData()
  }

  async function deleteTask(taskId: string) {
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', taskId)
    loadData()
  }

  function toggleChild(childId: string) {
    setAssignedChildren(prev => prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId])
  }

  const chores = tasks.filter(t => t.type === 'chore')
  const routines = tasks.filter(t => t.type === 'routine')

  if (pageLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-spin">⭐</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-gradient-to-br from-purple-500 to-pink-500 pt-12 pb-8 px-4">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Tasks</h1>
            <p className="text-purple-200 text-sm">{tasks.length} total</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setFormError('') }}
            className="bg-white text-purple-600 font-bold px-4 py-2 rounded-2xl text-sm shadow active:scale-95 transition"
          >
            {showForm ? '✕ Close' : '+ Add Task'}
          </button>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-4">
        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800">New Task</h2>

            <div className="flex bg-gray-100 rounded-2xl p-1">
              {(['chore', 'routine'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition capitalize ${type === t ? 'bg-white text-purple-600 shadow' : 'text-gray-400'}`}>
                  {t}
                </button>
              ))}
            </div>

            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder={type === 'chore' ? 'e.g. Make bed, Tidy room...' : 'e.g. Brush teeth, Read...'}
            />

            <div>
              <p className="text-xs text-gray-500 mb-2">Choose an emoji</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    className={`text-2xl p-1.5 rounded-xl transition ${emoji === e ? 'bg-purple-100 ring-2 ring-purple-400' : 'hover:bg-gray-100'}`}>
                    {e}
                  </button>
                ))}
              </div>
              <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)}
                className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-center text-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                maxLength={2} placeholder="✏️" />
            </div>

            {type === 'routine' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Time of day</p>
                <div className="flex gap-2">
                  {TIME_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setTimeOfDay(opt.value)}
                      className={`flex-1 py-2 rounded-2xl text-xs font-semibold transition ${timeOfDay === opt.value ? 'bg-purple-100 text-purple-600 ring-2 ring-purple-300' : 'bg-gray-100 text-gray-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-2">
                Stars to earn: <span className="font-bold text-yellow-500">⭐ {starValue}</span>
              </p>
              <input type="range" min={1} max={10} value={starValue}
                onChange={e => setStarValue(Number(e.target.value))}
                className="w-full accent-purple-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1 star</span><span>10 stars</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-700">Requires photo proof 📷</p>
                <p className="text-xs text-gray-400">Kid snaps a photo when done</p>
              </div>
              <button onClick={() => setRequiresPhoto(!requiresPhoto)}
                className={`w-12 h-6 rounded-full transition-colors relative ${requiresPhoto ? 'bg-purple-500' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${requiresPhoto ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Assign to</p>
              <div className="flex gap-2 flex-wrap">
                {children.map(child => (
                  <button key={child.id} onClick={() => toggleChild(child.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${assignedChildren.includes(child.id) ? 'ring-2 ring-purple-400' : 'opacity-50'}`}
                    style={{ backgroundColor: child.colour + '33' }}>
                    {child.avatar} {child.name}
                  </button>
                ))}
              </div>
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <button onClick={saveTask} disabled={saving}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Task ✓'}
            </button>
          </div>
        )}

        {/* Chores list */}
        {chores.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Chores ({chores.length})</p>
            <div className="space-y-2">
              {chores.map(task => (
                <TaskRow key={task.id} task={task} assignedIds={assignments[task.id] || []} children={children} onDelete={deleteTask} />
              ))}
            </div>
          </div>
        )}

        {/* Routines list */}
        {routines.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Routines ({routines.length})</p>
            <div className="space-y-2">
              {routines.map(task => (
                <TaskRow key={task.id} task={task} assignedIds={assignments[task.id] || []} children={children} onDelete={deleteTask} />
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && !showForm && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-500 font-medium">No tasks yet</p>
            <p className="text-gray-400 text-sm mt-1">Tap "+ Add Task" to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, assignedIds, children, onDelete }: {
  task: Task
  assignedIds: string[]
  children: Child[]
  onDelete: (id: string) => void
}) {
  const assigned = children.filter(c => assignedIds.includes(c.id))
  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
      <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
        {task.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">⭐ {task.star_value}</span>
          {task.time_of_day && <span className="text-xs text-gray-400">· {task.time_of_day}</span>}
          {task.requires_photo && <span className="text-xs text-gray-400">· 📷</span>}
        </div>
        {assigned.length > 0 && (
          <div className="flex gap-0.5 mt-1">
            {assigned.map(c => <span key={c.id} className="text-base">{c.avatar}</span>)}
          </div>
        )}
      </div>
      <button onClick={() => onDelete(task.id)} className="text-gray-300 hover:text-red-400 text-2xl font-bold flex-shrink-0 transition">
        ×
      </button>
    </div>
  )
}
