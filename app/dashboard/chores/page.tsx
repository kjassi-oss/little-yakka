'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const EMOJIS = ['🛏️','🧹','🍽️','🧺','📚','🐕','🌿','🗑️','🛁','🧼','🪥','🍳','🚿','🧽','👕','🎒','🏃','🌙','⭐','🎨']
const TIME_OPTIONS = [
  { value: 'morning',   label: '🌅 Morning' },
  { value: 'afternoon', label: '☀️ Afternoon' },
  { value: 'evening',   label: '🌙 Evening' },
]
const FREQ_OPTIONS = [
  { value: 'daily',   label: '📅 Daily' },
  { value: 'weekly',  label: '🗓️ Weekly' },
  { value: 'monthly', label: '📆 Monthly' },
]

interface Task {
  id: string
  title: string
  emoji: string
  type: 'chore' | 'routine'
  time_of_day: string | null
  star_value: number
  requires_photo: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  carry_over: boolean
}

interface Child { id: string; name: string; avatar: string; colour: string }

export default function ChoresPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [familyId, setFamilyId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('⭐')
  const [type, setType] = useState<'chore' | 'routine'>('chore')
  const [timeOfDay, setTimeOfDay] = useState('morning')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [carryOver, setCarryOver] = useState(true)
  const [starValue, setStarValue] = useState(3)
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

  function openNewForm() {
    setEditingTaskId(null)
    setTitle(''); setEmoji('⭐'); setType('chore'); setTimeOfDay('morning')
    setFrequency('daily'); setCarryOver(true); setStarValue(3)
    setRequiresPhoto(false); setAssignedChildren([])
    setFormError('')
    setShowForm(true)
  }

  function openEditForm(task: Task) {
    setEditingTaskId(task.id)
    setTitle(task.title)
    setEmoji(task.emoji)
    setType(task.type)
    setTimeOfDay(task.time_of_day || 'morning')
    setFrequency(task.frequency || 'daily')
    setCarryOver(task.carry_over ?? true)
    setStarValue(task.star_value)
    setRequiresPhoto(task.requires_photo)
    setAssignedChildren(assignments[task.id] || [])
    setFormError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTaskId(null)
  }

  async function saveTask() {
    if (!title.trim()) { setFormError('Please enter a task name.'); return }
    if (assignedChildren.length === 0) { setFormError('Please assign this task to at least one child.'); return }
    setSaving(true); setFormError('')

    const supabase = createClient()
    const payload = {
      title: title.trim(), emoji, type,
      time_of_day: type === 'routine' ? timeOfDay : null,
      star_value: starValue, requires_photo: requiresPhoto,
      frequency, carry_over: carryOver,
    }

    if (editingTaskId) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editingTaskId)
      if (error) { setFormError(error.message); setSaving(false); return }
      await supabase.from('task_assignments').delete().eq('task_id', editingTaskId)
      await supabase.from('task_assignments').insert(assignedChildren.map(cid => ({ task_id: editingTaskId, child_id: cid })))
    } else {
      const { data: task, error } = await supabase.from('tasks')
        .insert({ ...payload, family_id: familyId, recurrence: frequency }).select().single()
      if (error || !task) { setFormError(error?.message || 'Failed to save.'); setSaving(false); return }
      await supabase.from('task_assignments').insert(assignedChildren.map(cid => ({ task_id: task.id, child_id: cid })))
    }

    closeForm()
    setSaving(false)
    loadData()
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', taskId)
    loadData()
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
      <div className="pt-12 pb-8 px-4" style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Tasks</h1>
            <p className="text-white/70 text-sm">{tasks.length} total</p>
          </div>
          <button onClick={showForm ? closeForm : openNewForm}
            className="bg-white font-bold px-4 py-2 rounded-2xl text-sm shadow active:scale-95 transition"
            style={{ color: 'var(--theme-from)' }}>
            {showForm ? '✕ Close' : '+ Add Task'}
          </button>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 mt-4 space-y-4">

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800">{editingTaskId ? 'Edit Task' : 'New Task'}</h2>

            <div className="flex bg-gray-100 rounded-2xl p-1">
              {(['chore', 'routine'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition capitalize ${type === t ? 'bg-white shadow' : 'text-gray-400'}`}
                  style={type === t ? { color: 'var(--theme-from)' } : {}}>
                  {t}
                </button>
              ))}
            </div>

            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--theme-from)' } as any}
              placeholder={type === 'chore' ? 'e.g. Make bed, Tidy room...' : 'e.g. Brush teeth, Read...'}/>

            <div>
              <p className="text-xs text-gray-500 mb-2">Choose an emoji</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    className={`text-2xl p-1.5 rounded-xl transition ${emoji === e ? 'ring-2' : 'hover:bg-gray-100'}`}
                    style={emoji === e ? { backgroundColor: 'var(--theme-from)22', ringColor: 'var(--theme-from)' } : {}}>
                    {e}
                  </button>
                ))}
              </div>
              <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)}
                className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-center text-xl focus:outline-none"
                maxLength={2} placeholder="✏️"/>
            </div>

            {/* Frequency */}
            <div>
              <p className="text-xs text-gray-500 mb-2">How often?</p>
              <div className="flex gap-2">
                {FREQ_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setFrequency(opt.value as any)}
                    className={`flex-1 py-2 rounded-2xl text-xs font-semibold transition ${frequency === opt.value ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={frequency === opt.value ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {type === 'routine' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Time of day</p>
                <div className="flex gap-2">
                  {TIME_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setTimeOfDay(opt.value)}
                      className={`flex-1 py-2 rounded-2xl text-xs font-semibold transition ${timeOfDay === opt.value ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                      style={timeOfDay === opt.value ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Carry over */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-700">Carry over if missed ↩️</p>
                <p className="text-xs text-gray-400">{carryOver ? 'Shows as overdue' : 'Marked expired'}</p>
              </div>
              <button onClick={() => setCarryOver(!carryOver)}
                className={`w-12 h-6 rounded-full transition-colors relative ${carryOver ? '' : 'bg-gray-200'}`}
                style={carryOver ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${carryOver ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Stars to earn: <span className="font-bold text-yellow-500">⭐ {starValue}</span></p>
              <input type="range" min={1} max={10} value={starValue}
                onChange={e => setStarValue(Number(e.target.value))} className="w-full"/>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>10</span></div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-700">Requires photo proof 📷</p>
                <p className="text-xs text-gray-400">Kid snaps a photo when done</p>
              </div>
              <button onClick={() => setRequiresPhoto(!requiresPhoto)}
                className={`w-12 h-6 rounded-full transition-colors relative ${requiresPhoto ? '' : 'bg-gray-200'}`}
                style={requiresPhoto ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${requiresPhoto ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Assign to</p>
              <div className="flex gap-2 flex-wrap">
                {children.map(child => (
                  <button key={child.id}
                    onClick={() => setAssignedChildren(prev => prev.includes(child.id) ? prev.filter(id => id !== child.id) : [...prev, child.id])}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${assignedChildren.includes(child.id) ? 'ring-2 ring-purple-400' : 'opacity-50'}`}
                    style={{ backgroundColor: child.colour + '33' }}>
                    {child.avatar} {child.name}
                  </button>
                ))}
              </div>
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <button onClick={saveTask} disabled={saving}
              className="w-full text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
              {saving ? 'Saving...' : editingTaskId ? 'Update Task ✓' : 'Save Task ✓'}
            </button>
          </div>
        )}

        {/* Chores */}
        {chores.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Chores ({chores.length})</p>
            <div className="space-y-2">
              {chores.map(task => (
                <TaskRow key={task.id} task={task} assignedIds={assignments[task.id] || []} children={children}
                  onEdit={() => openEditForm(task)} onDelete={() => deleteTask(task.id)}/>
              ))}
            </div>
          </div>
        )}

        {/* Routines */}
        {routines.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Routines ({routines.length})</p>
            <div className="space-y-2">
              {routines.map(task => (
                <TaskRow key={task.id} task={task} assignedIds={assignments[task.id] || []} children={children}
                  onEdit={() => openEditForm(task)} onDelete={() => deleteTask(task.id)}/>
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

function TaskRow({ task, assignedIds, children, onEdit, onDelete }: {
  task: Task; assignedIds: string[]; children: Child[]
  onEdit: () => void; onDelete: () => void
}) {
  const assigned = children.filter(c => assignedIds.includes(c.id))
  const freqLabels: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
      <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">{task.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">⭐ {task.star_value}</span>
          {task.time_of_day && <span className="text-xs text-gray-400">· {task.time_of_day}</span>}
          {task.frequency && task.frequency !== 'daily' && (
            <span className="text-xs bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded-full font-medium">{freqLabels[task.frequency]}</span>
          )}
          {task.requires_photo && <span className="text-xs text-gray-400">· 📷</span>}
          {!task.carry_over && <span className="text-xs text-orange-400">· no carry-over</span>}
        </div>
        {assigned.length > 0 && (
          <div className="flex gap-0.5 mt-1">{assigned.map(c => <span key={c.id} className="text-base">{c.avatar}</span>)}</div>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="text-gray-400 hover:text-purple-500 p-1.5 transition text-base">✏️</button>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 text-2xl font-bold transition leading-none">×</button>
      </div>
    </div>
  )
}
