'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'
import { occursOn } from '@/lib/recurrence'
import LoadingLogo from '@/components/LoadingLogo'
import CelebrationBurst from '@/components/CelebrationBurst'
import { completionFeedback } from '@/lib/feedback'

// Searchable emoji set (keywords drive the search box)
const EMOJI_OPTIONS: { e: string; kw: string }[] = [
  { e: '⭐', kw: 'star reward good special' },
  { e: '🛏️', kw: 'bed make sleep bedroom' }, { e: '🧹', kw: 'sweep broom clean tidy floor' },
  { e: '🍽️', kw: 'dishes plate dinner table eat clear' }, { e: '🧺', kw: 'laundry washing clothes' },
  { e: '📖', kw: 'reading book bedtime story read' }, { e: '📝', kw: 'homework write notes school' },
  { e: '🎵', kw: 'music practice song sing' }, { e: '🪈', kw: 'flute music practice instrument' },
  { e: '🎺', kw: 'trumpet music practice brass instrument' },
  { e: '📚', kw: 'books read study homework school' }, { e: '🐕', kw: 'dog pet walk feed' },
  { e: '🐈', kw: 'cat pet feed litter' }, { e: '🐟', kw: 'fish pet feed tank' },
  { e: '🌿', kw: 'plant garden water weeds' }, { e: '🗑️', kw: 'bin rubbish trash garbage empty' },
  { e: '♻️', kw: 'recycle recycling bins' }, { e: '🛁', kw: 'bath wash clean' },
  { e: '🧼', kw: 'soap wash hands clean' }, { e: '🪥', kw: 'toothbrush teeth brush' },
  { e: '🍳', kw: 'cook breakfast egg kitchen help' }, { e: '🚿', kw: 'shower wash clean' },
  { e: '🧽', kw: 'sponge wipe clean scrub' }, { e: '👕', kw: 'shirt clothes get dressed fold' },
  { e: '🧦', kw: 'socks clothes pairs' }, { e: '👟', kw: 'shoes tidy put away' },
  { e: '🎒', kw: 'bag school pack backpack' }, { e: '🏃', kw: 'run exercise sport active' },
  { e: '🌙', kw: 'night bedtime sleep evening' }, { e: '🎨', kw: 'art draw paint craft' },
  { e: '🪀', kw: 'toys play tidy pack away' }, { e: '🧸', kw: 'toys teddy tidy bedroom' },
  { e: '🧴', kw: 'lotion sunscreen cream' }, { e: '💊', kw: 'medicine vitamin tablet' },
  { e: '🥤', kw: 'drink water bottle' }, { e: '🍎', kw: 'fruit apple healthy snack eat' },
  { e: '🥕', kw: 'veg carrot vegetables eat' }, { e: '🍌', kw: 'banana fruit snack' },
  { e: '🥣', kw: 'cereal breakfast bowl' }, { e: '🧊', kw: 'fridge ice freezer' },
  { e: '🪟', kw: 'window clean wipe' }, { e: '🚪', kw: 'door close lock' },
  { e: '🛒', kw: 'shopping groceries store help' }, { e: '🧻', kw: 'toilet paper roll bathroom' },
  { e: '🚽', kw: 'toilet clean bathroom' }, { e: '🪣', kw: 'bucket mop clean water' },
  { e: '🧷', kw: 'tidy organise pin' }, { e: '✏️', kw: 'pencil write draw school' },
  { e: '🎹', kw: 'piano music practice keys' }, { e: '🎸', kw: 'guitar music practice strings' },
  { e: '🥁', kw: 'drums music practice percussion' }, { e: '🎷', kw: 'saxophone sax music practice' },
  { e: '🎻', kw: 'violin music practice strings' }, { e: '⚽', kw: 'soccer football sport play' },
  { e: '🏀', kw: 'basketball sport play' }, { e: '🚲', kw: 'bike ride cycle' },
  { e: '🧠', kw: 'study think learn brain' }, { e: '💧', kw: 'water plants drink' },
  { e: '🌳', kw: 'tree garden outside yard' }, { e: '🍂', kw: 'leaves rake garden yard' },
  { e: '☀️', kw: 'morning sun wake up' }, { e: '❤️', kw: 'love kind helpful' },
  { e: '🙏', kw: 'manners please thanks pray' }, { e: '😴', kw: 'sleep nap bedtime rest' },
  { e: '🪴', kw: 'plant pot water garden' }, { e: '🍪', kw: 'snack treat baking' },
  { e: '🐾', kw: 'pet animal feed' }, { e: '🚗', kw: 'car wash tidy' },
  { e: '🎯', kw: 'goal target focus' }, { e: '📦', kw: 'box pack tidy put away' },
]
const TIME_OPTIONS = [
  { value: 'anytime',   label: '📋 Anytime' },
  { value: 'morning',   label: '🌅 Morning' },
  { value: 'afternoon', label: '☀️ Afternoon' },
  { value: 'evening',   label: '🌙 Evening' },
]
const FREQ_OPTIONS = [
  { value: 'daily',   label: '📅 Daily' },
  { value: 'weekly',  label: '🗓️ Weekly' },
  { value: 'monthly', label: '📆 Monthly' },
]
const UP_TIME_ORDER: Record<string, number> = { morning: 1, afternoon: 2, evening: 3 }
// Local-timezone YYYY-MM-DD (avoids the UTC off-by-one that toISOString causes in AEST)
function ymdLocal(d: Date): string { return new Intl.DateTimeFormat('en-CA').format(d) }

interface Task {
  id: string; title: string; emoji: string; type: 'chore' | 'routine'
  time_of_day: string | null; star_value: number
  requires_photo: boolean; requires_benchmark_photo: boolean
  benchmark_differs_per_child: boolean
  frequency: 'daily' | 'weekly' | 'monthly'; carry_over: boolean
  start_date?: string | null; requires_approval?: boolean
  days_of_week?: number[] | null
}
interface Child { id: string; name: string; avatar: string; colour: string; avatar_url?: string }
interface HistoryRow {
  id: string; date: string; child_id: string; star_value: number
  tasks: { title: string; emoji: string; star_value: number } | null
  children: { name: string; avatar: string; colour: string; avatar_url?: string } | null
}

type MainTab = 'upcoming' | 'history' | 'tasks'

export default function ChoresPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [completedSet, setCompletedSet] = useState(new Set<string>())
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [familyId, setFamilyId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('upcoming')
  const [filterChildId, setFilterChildId] = useState<string | null>(null)
  const [showChildPicker, setShowChildPicker] = useState(false)
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<HistoryRow[]>([])
  const [todayOnly, setTodayOnly] = useState(false)
  const [expandedDoneChild, setExpandedDoneChild] = useState<string | null>(null)
  // Upcoming tab: multi-select child filter (empty Set = everyone) + window completions
  const [upcomingFilter, setUpcomingFilter] = useState<Set<string>>(new Set())
  const [windowComps, setWindowComps] = useState<{ id: string; task_id: string; child_id: string; date: string }[]>([])
  const [pastWindow, setPastWindow] = useState(0) // days of history shown in Upcoming (0 = today only; max 7)
  const [burst, setBurst] = useState<{ colour: string; emoji: string; title: string; sub?: string } | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🧹')
  const [type, setType] = useState<'chore' | 'routine'>('chore')
  const [timeOfDay, setTimeOfDay] = useState('anytime')
  const [startDate, setStartDate] = useState('')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [emojiSearch, setEmojiSearch] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [carryOver, setCarryOver] = useState(true)
  const [starValue, setStarValue] = useState(3)
  const [requiresPhoto, setRequiresPhoto] = useState(false)
  const [requiresBenchmarkPhoto, setRequiresBenchmarkPhoto] = useState(false)
  const [benchmarkDiffersPerChild, setBenchmarkDiffersPerChild] = useState(false)
  const [benchmarkFiles, setBenchmarkFiles] = useState<File[]>([])
  const [benchmarkVideo, setBenchmarkVideo] = useState<File | null>(null)
  const [existingBenchmarks, setExistingBenchmarks] = useState<{ id: string; url: string; media_type: string }[]>([])
  const [assignedChildren, setAssignedChildren] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [canDoEarly, setCanDoEarly] = useState(true)
  const [upForGrabs, setUpForGrabs] = useState(false)
  const [expiresOn, setExpiresOn] = useState('')
  // Up-for-grabs claim state: task_id -> completion row (any child, any date)
  const [ufgClaims, setUfgClaims] = useState<{ id: string; task_id: string; child_id: string; date: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const benchmarkPhotoRef = useRef<HTMLInputElement>(null)
  const benchmarkVideoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
    // Deep-link from the home tiles: /dashboard/chores?child=<id> preselects that child
    const params = new URLSearchParams(window.location.search)
    const childParam = params.get('child')
    if (childParam) { setUpcomingFilter(new Set([childParam])); setMainTab('upcoming') }
  }, [])


  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: guardian } = await supabase.from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return
    setFamilyId(guardian.family_id)

    const today = new Date().toISOString().split('T')[0]
    const [{ data: tasksData }, { data: childrenData }, { data: assignmentsData }, { data: completionsData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('family_id', guardian.family_id).order('created_at'),
      supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
      supabase.from('task_assignments').select('task_id, child_id'),
      supabase.from('completions').select('task_id, child_id, status').eq('date', today),
    ])

    const map: Record<string, string[]> = {}
    assignmentsData?.forEach(a => { if (!map[a.task_id]) map[a.task_id] = []; map[a.task_id].push(a.child_id) })
    setTasks(tasksData || [])
    setChildren(childrenData || [])
    setAssignments(map)
    setCompletedSet(new Set(
      completionsData?.filter(c => c.status === 'approved' || c.status === 'pending')
        .map(c => `${c.task_id}-${c.child_id}`) || []
    ))
    setPageLoading(false)

    // Completion history + pending approvals (moved here from the old History page)
    const childIds = childrenData?.map(c => c.id) || []
    const [{ data: historyData }, { data: approvalData }] = await Promise.all([
      supabase.from('completions')
        .select('id, date, child_id, tasks(title, emoji, star_value), children(name, avatar, colour, avatar_url)')
        .eq('status', 'approved')
        .in('child_id', childIds.length ? childIds : ['none'])
        .order('created_at', { ascending: false })
        .limit(120),
      supabase.from('completions')
        .select('id, date, child_id, tasks(title, emoji, star_value), children(name, avatar, colour, avatar_url)')
        .eq('status', 'pending')
        .in('child_id', childIds.length ? childIds : ['none'])
        .order('created_at', { ascending: false }),
    ])
    setHistory((historyData as any) || [])
    setPendingApprovals((approvalData as any) || [])

    // Completions across the Upcoming window (past 2 weeks → today) for done/missed state
    const winStart = new Date(); winStart.setDate(winStart.getDate() - 14)
    const { data: winData } = await supabase.from('completions')
      .select('id, task_id, child_id, date, status')
      .in('child_id', childIds.length ? childIds : ['none'])
      .gte('date', ymdLocal(winStart)).lte('date', ymdLocal(new Date()))
    setWindowComps((winData || []).filter(c => c.status === 'approved' || c.status === 'pending')
      .map(c => ({ id: c.id, task_id: c.task_id, child_id: c.child_id, date: c.date })))

    // Up-for-grabs claims: first completion (any child, any date) claims the task
    const ufgIds = (tasksData || []).filter((t: any) => t.up_for_grabs).map(t => t.id)
    if (ufgIds.length) {
      const { data: claims } = await supabase.from('completions')
        .select('id, task_id, child_id, date').in('task_id', ufgIds)
      setUfgClaims((claims || []) as any)
    } else {
      setUfgClaims([])
    }
  }

  function toggleUpcomingChild(id: string) {
    setUpcomingFilter(prev => {
      // From "everyone" (empty), first tap isolates to that child; further taps add/remove.
      if (prev.size === 0) return new Set([id])
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function undoUpcoming(comp: { id: string; child_id: string }, task: Task, childName: string) {
    if (!confirm(`Undo "${task.title}"${childName ? ' for ' + childName : ''}? This removes the stars.`)) return
    const supabase = createClient()
    await supabase.from('completions').delete().eq('id', comp.id)
    await supabase.from('star_ledger').insert({
      child_id: comp.child_id, delta: -(task.star_value || 0),
      reason: `Undo: ${task.title}`, source_type: 'undo',
    })
    loadData()
  }

  // Complete a task occurrence for a specific child straight from the Upcoming list
  async function completeUpcoming(task: Task, childId: string, date: string, child?: Child) {
    completionFeedback()
    setBurst({ colour: child?.colour || '#EC4899', emoji: task.emoji, title: 'Nice one! 🎉', sub: `+${task.star_value} ⭐` })
    const supabase = createClient()
    const { data: completion } = await supabase.from('completions')
      .insert({ task_id: task.id, child_id: childId, date, status: 'approved' }).select('id').single()
    await supabase.from('star_ledger').insert({
      child_id: childId, delta: task.star_value || 0,
      reason: `Completed: ${task.title}`, source_type: 'completion', source_id: completion?.id,
    })
    // Nudge the family's subscribed devices (fire-and-forget)
    fetch('/api/push/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '⭐ Task done!', body: `${child?.name.split(' ')[0] || 'Someone'} finished "${task.title}" (+${task.star_value} ⭐)` }),
    }).catch(() => {})
    loadData()
  }

  // Multi-child: tapping a task asks which child (or jumps straight in if only one)
  function openTaskForChild(task: Task) {
    const ids = (assignments[task.id] || []).filter(cid => upcomingFilter.size === 0 || upcomingFilter.has(cid))
    if (ids.length === 1) router.push(`/kid-mode/${ids[0]}?task=${task.id}`)
    else { setPendingTaskId(task.id); setShowChildPicker(true) }
  }

  function handleTaskClick(task: Task) {
    // Tapping a task jumps into the kid zone, deep-linked to that task.
    const kids = assignments[task.id] || []
    if (filterChildId) router.push(`/kid-mode/${filterChildId}?task=${task.id}`)
    else if (kids.length === 1) router.push(`/kid-mode/${kids[0]}?task=${task.id}`)
    else { setPendingTaskId(task.id); setShowChildPicker(true) }
  }

  async function approveCompletion(row: HistoryRow) {
    const supabase = createClient()
    await supabase.from('completions').update({ status: 'approved' }).eq('id', row.id)
    await supabase.from('star_ledger').insert({
      child_id: row.child_id,
      delta: row.tasks?.star_value || 0,
      reason: `Approved: ${row.tasks?.title}`,
      source_type: 'completion',
      source_id: row.id,
    })
    loadData()
  }

  async function rejectCompletion(row: HistoryRow) {
    if (!confirm(`Reject "${row.tasks?.title}" for ${row.children?.name}? No stars will be given.`)) return
    await createClient().from('completions').delete().eq('id', row.id)
    loadData()
  }

  function openNewForm() {
    setEditingTaskId(null)
    setTitle(''); setEmoji('⭐'); setType('chore'); setTimeOfDay('anytime')
    setFrequency('daily'); setCarryOver(true); setStarValue(3)
    setStartDate(new Date().toISOString().split('T')[0])
    setRequiresPhoto(false); setRequiresBenchmarkPhoto(false)
    setBenchmarkDiffersPerChild(false); setBenchmarkFiles([]); setBenchmarkVideo(null)
    setExistingBenchmarks([]); setAssignedChildren([]); setDifficulty('medium')
    setRequiresApproval(false); setCanDoEarly(true); setDaysOfWeek([])
    setUpForGrabs(false); setExpiresOn('')
    setFormError('')
    setShowForm(true)
  }

  async function openEditForm(task: Task) {
    setEditingTaskId(task.id)
    setTitle(task.title); setEmoji(task.emoji); setType(task.type)
    setTimeOfDay(task.time_of_day || 'anytime')
    setFrequency(task.frequency || 'daily'); setCarryOver(task.carry_over ?? true)
    setStarValue(task.star_value); setRequiresPhoto(task.requires_photo)
    setStartDate(task.start_date || '')
    setRequiresBenchmarkPhoto(task.requires_benchmark_photo || false)
    setBenchmarkDiffersPerChild(task.benchmark_differs_per_child || false)
    setBenchmarkFiles([]); setBenchmarkVideo(null)
    setAssignedChildren(assignments[task.id] || [])
    setDifficulty((task as any).difficulty || 'medium')
    setRequiresApproval((task as any).requires_approval || false)
    setCanDoEarly((task as any).can_do_early ?? true)
    setDaysOfWeek(task.days_of_week || [])
    setUpForGrabs((task as any).up_for_grabs ?? false)
    setExpiresOn((task as any).expires_on || '')
    setFormError('')
    setShowForm(true)
    const supabase = createClient()
    const { data } = await supabase.from('task_benchmark_photos').select('id, url, media_type').eq('task_id', task.id)
    setExistingBenchmarks(data || [])
  }

  function closeForm() { setShowForm(false); setEditingTaskId(null) }

  async function saveTask() {
    if (!title.trim()) { setFormError('Please enter a task name.'); return }
    if (!upForGrabs && assignedChildren.length === 0) { setFormError('Please assign to at least one child.'); return }
    setSaving(true); setFormError('')
    const supabase = createClient()

    // Build base payload without newer columns; add them if they exist
    const basePayload = {
      title: title.trim(), emoji, type,
      time_of_day: timeOfDay === 'anytime' ? null : timeOfDay,
      star_value: starValue,
      start_date: startDate || null,
      requires_photo: requiresPhoto || requiresBenchmarkPhoto,
      requires_benchmark_photo: requiresBenchmarkPhoto,
      benchmark_differs_per_child: benchmarkDiffersPerChild,
      // Up-for-grabs is a one-off: no recurrence, no carry-over restrictions
      frequency: upForGrabs ? 'daily' : frequency,
      carry_over: upForGrabs ? false : carryOver,
      difficulty,
      requires_approval: false,
      days_of_week: !upForGrabs && frequency === 'daily' && daysOfWeek.length > 0 && daysOfWeek.length < 7 ? [...daysOfWeek].sort() : null,
    }
    const midPayload = { ...basePayload, can_do_early: upForGrabs ? true : canDoEarly }
    const payload = { ...midPayload, up_for_grabs: upForGrabs, expires_on: upForGrabs && expiresOn ? expiresOn : null }

    // Try full payload, then progressively drop columns the DB doesn't have yet
    async function saveWith(id: string | null): Promise<{ data: any; error: any }> {
      const attempt = (p: any) => id
        ? supabase.from('tasks').update(p).eq('id', id).select().single()
        : supabase.from('tasks').insert({ ...p, family_id: familyId, recurrence: p.frequency }).select().single()
      let res = await attempt(payload)
      if (res.error?.message?.includes('up_for_grabs') || res.error?.message?.includes('expires_on')) res = await attempt(midPayload)
      if (res.error?.message?.includes('can_do_early')) res = await attempt(basePayload)
      return res
    }

    let taskId = editingTaskId
    const { data: task, error } = await saveWith(editingTaskId)
    if (error || !task) { setFormError(error?.message || 'Failed to save.'); setSaving(false); return }
    taskId = task.id

    // Up-for-grabs tasks have no assignments; normal tasks get reassigned
    if (editingTaskId) await supabase.from('task_assignments').delete().eq('task_id', editingTaskId)
    if (!upForGrabs && assignedChildren.length) {
      await supabase.from('task_assignments').insert(assignedChildren.map(cid => ({ task_id: taskId, child_id: cid })))
    }

    if (taskId && requiresBenchmarkPhoto) {
      for (let i = 0; i < benchmarkFiles.length; i++) {
        const file = benchmarkFiles[i]
        const ext = file.name.split('.').pop()
        const path = `${familyId}/${taskId}/photo_${i}.${ext}`
        const { error: upErr } = await supabase.storage.from('task-benchmarks').upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('task-benchmarks').getPublicUrl(path)
          await supabase.from('task_benchmark_photos').insert({ task_id: taskId, url: publicUrl, media_type: 'photo', sort_order: i })
        }
      }
      if (benchmarkVideo) {
        const ext = benchmarkVideo.name.split('.').pop()
        const path = `${familyId}/${taskId}/video.${ext}`
        const { error: upErr } = await supabase.storage.from('task-benchmarks').upload(path, benchmarkVideo, { upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('task-benchmarks').getPublicUrl(path)
          await supabase.from('task_benchmark_photos').insert({ task_id: taskId, url: publicUrl, media_type: 'video', sort_order: 99 })
        }
      }
    }

    closeForm(); setSaving(false); loadData()
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    await createClient().from('tasks').delete().eq('id', taskId)
    loadData()
  }

  async function undoCompletion(row: HistoryRow) {
    if (!confirm(`Undo "${row.tasks?.title}" for ${row.children?.name}? This removes the stars.`)) return
    const supabase = createClient()
    await supabase.from('completions').delete().eq('id', row.id)
    await supabase.from('star_ledger').insert({
      child_id: row.child_id,
      delta: -(row.tasks?.star_value || 0),
      reason: `Undo: ${row.tasks?.title}`,
      source_type: 'undo',
    })
    loadData()
  }

  const childMap: Record<string, Child> = {}
  children.forEach(c => { childMap[c.id] = c })

  const _now = new Date()
  const visibleTasks = (filterChildId
    ? tasks.filter(t => (assignments[t.id] || []).includes(filterChildId))
    : tasks
  ).filter(t => !todayOnly || occursOn(t as any, _now))

  const todayStr = new Date().toISOString().split('T')[0]

  if (pageLoading) return <LoadingLogo />

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Compact header — logo left, centred title, settings right */}
      <div className="pt-11 pb-2.5 px-4 bg-white border-b border-gray-100">
        <div className="max-w-sm lg:max-w-3xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
          <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto justify-self-start" onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
          <span className="text-4xl font-black justify-self-center leading-none" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tasks</span>
          <div className="justify-self-end"><ProfileButton/></div>
        </div>
      </div>

      {/* Tab toggle (white sub-bar) — Upcoming · Done · All */}
      <div className="bg-white px-4 pt-2.5 pb-1">
        <div className="max-w-sm lg:max-w-3xl mx-auto flex bg-gray-100 rounded-2xl p-1 gap-1">
          {([['upcoming', '📅 Upcoming'], ['history', '✅ Done'], ['tasks', '📋 All']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setMainTab(tab)}
              className={`relative flex-1 py-1.5 rounded-xl text-sm font-semibold transition ${mainTab === tab ? 'text-white shadow' : 'text-gray-400'}`}
              style={mainTab === tab ? { background: 'var(--theme-gradient)' } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Kid filter — round photo thumbnails, 4 per row (All tab only) */}
      {children.length > 0 && mainTab === 'tasks' && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
          <div className="max-w-sm lg:max-w-3xl mx-auto grid grid-cols-4 gap-3">
            {/* All */}
            <button onClick={() => setFilterChildId(null)} className="flex flex-col items-center gap-1 active:scale-95 transition">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black ${!filterChildId ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                style={!filterChildId ? { background: 'var(--theme-gradient)', boxShadow: '0 0 0 3px white, 0 0 0 5px var(--theme-from)' } : {}}>
                All
              </div>
              <span className={`text-[11px] font-bold ${!filterChildId ? '' : 'text-gray-400'}`}
                style={!filterChildId ? { color: 'var(--theme-from)' } : {}}>Everyone</span>
            </button>
            {children.map(child => {
              const sel = filterChildId === child.id
              return (
                <button key={child.id} onClick={() => setFilterChildId(sel ? null : child.id)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition">
                  {child.avatar_url
                    ? <img src={child.avatar_url} alt={child.name} className="w-14 h-14 rounded-full object-cover"
                        style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}/>
                    : <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                        style={{ backgroundColor: child.colour + '25', boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}>
                        {child.avatar}
                      </div>
                  }
                  <span className="text-[11px] font-bold truncate max-w-[56px]"
                    style={{ color: sel ? child.colour : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-w-sm lg:max-w-3xl mx-auto px-4 mt-4 space-y-4">

        {/* Add/Edit Form */}
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
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder={type === 'chore' ? 'e.g. Make bed, Tidy room...' : 'e.g. Brush teeth, Read...'}/>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 16%, white)' }}>{emoji}</div>
                <input type="text" value={emojiSearch} onChange={e => setEmojiSearch(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="🔍 Search icons (e.g. bed, teeth, dog)"/>
              </div>
              <div className="grid grid-cols-7 gap-1 max-h-40 overflow-y-auto p-1 bg-gray-50 rounded-2xl">
                {EMOJI_OPTIONS
                  .filter(o => { const q = emojiSearch.trim().toLowerCase(); return !q || o.kw.includes(q) })
                  .map((o, i) => (
                    <button key={`${o.e}-${i}`} onClick={() => setEmoji(o.e)}
                      className={`text-2xl p-1.5 rounded-xl transition ${emoji === o.e ? 'ring-2 ring-purple-400 bg-white' : 'hover:bg-white'}`}>
                      {o.e}
                    </button>
                  ))}
              </div>
            </div>

            {/* Up for grabs — unassigned; any child can claim it, first done wins */}
            <div className="rounded-2xl p-3 border-2 border-dashed border-amber-300 bg-amber-50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-amber-700">🙌 Up For Grabs</p>
                  <p className="text-xs text-amber-600">{upForGrabs ? 'Anyone can claim it — first done wins the stars!' : 'No child assigned — any child can do it'}</p>
                </div>
                <button onClick={() => setUpForGrabs(!upForGrabs)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${upForGrabs ? 'bg-amber-400' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${upForGrabs ? 'translate-x-6' : 'translate-x-0.5'}`}/>
                </button>
              </div>
              {upForGrabs && (
                <div>
                  <p className="text-xs text-amber-600 mb-1">Expiry date <span className="opacity-60">(optional — leave blank to keep it open)</span></p>
                  <input type="date" value={expiresOn} onChange={e => setExpiresOn(e.target.value)}
                    className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                </div>
              )}
            </div>

            {!upForGrabs && (<>
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

            {frequency === 'daily' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Which days? <span className="text-gray-300">{daysOfWeek.length === 0 ? '(every day)' : ''}</span></p>
                <div className="flex gap-1.5">
                  {[['M', 1], ['T', 2], ['W', 3], ['T', 4], ['F', 5], ['S', 6], ['S', 0]].map(([lbl, dow], i) => {
                    const on = daysOfWeek.includes(dow as number)
                    return (
                      <button key={i} onClick={() => setDaysOfWeek(prev => prev.includes(dow as number) ? prev.filter(x => x !== dow) : [...prev, dow as number])}
                        className={`flex-1 h-9 rounded-xl text-xs font-bold transition ${on ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                        style={on ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                        {lbl}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Leave all off for every day, or pick specific days.</p>
              </div>
            )}
            </>)}

            <div>
              <p className="text-xs text-gray-500 mb-2">Time of day</p>
              <div className="grid grid-cols-2 gap-2">
                {TIME_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setTimeOfDay(opt.value)}
                    className={`py-2 rounded-2xl text-xs font-semibold transition ${timeOfDay === opt.value ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={timeOfDay === opt.value ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Start date <span className="text-gray-300">(optional — defaults to today)</span></p>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
            </div>

            {!upForGrabs && (<>
            <div className="flex items-center justify-between py-1">
              <div><p className="text-sm font-medium text-gray-700">Carry over if missed ↩️</p><p className="text-xs text-gray-400">{carryOver ? 'Shows as overdue' : 'Marked expired'}</p></div>
              <button onClick={() => setCarryOver(!carryOver)}
                className={`w-12 h-6 rounded-full transition-colors relative ${carryOver ? '' : 'bg-gray-200'}`}
                style={carryOver ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${carryOver ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-700">Can be done early 🗓️</p>
                <p className="text-xs text-gray-400">{canDoEarly ? 'Kids can do future days now' : 'Only on the scheduled day'}</p>
              </div>
              <button onClick={() => setCanDoEarly(!canDoEarly)}
                className={`w-12 h-6 rounded-full transition-colors relative ${canDoEarly ? '' : 'bg-gray-200'}`}
                style={canDoEarly ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${canDoEarly ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>
            </>)}

            <div>
              <p className="text-xs text-gray-500 mb-2">Stars to earn: <span className="font-bold text-yellow-500">⭐ {starValue}</span></p>
              <input type="range" min={1} max={250} value={starValue} onChange={e => setStarValue(Number(e.target.value))} className="w-full"/>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>50</span><span>100</span><span>250</span></div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div><p className="text-sm font-medium text-gray-700">Add benchmark photos 🖼️</p><p className="text-xs text-gray-400">Show kids the expected standard</p></div>
              <button onClick={() => setRequiresBenchmarkPhoto(!requiresBenchmarkPhoto)}
                className={`w-12 h-6 rounded-full transition-colors relative ${requiresBenchmarkPhoto ? '' : 'bg-gray-200'}`}
                style={requiresBenchmarkPhoto ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${requiresBenchmarkPhoto ? 'translate-x-6' : 'translate-x-0.5'}`}/>
              </button>
            </div>

            {requiresBenchmarkPhoto && (
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                {existingBenchmarks.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Current benchmarks</p>
                    <div className="flex gap-2 flex-wrap">
                      {existingBenchmarks.map(b => (
                        <div key={b.id} className="relative">
                          {b.media_type === 'video'
                            ? <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center text-2xl">🎥</div>
                            : <img src={b.url} className="w-16 h-16 object-cover rounded-xl" alt="benchmark"/>}
                          <button onClick={async () => {
                            await createClient().from('task_benchmark_photos').delete().eq('id', b.id)
                            setExistingBenchmarks(prev => prev.filter(x => x.id !== b.id))
                          }} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Add photos <span className="text-gray-400">(up to {5 - existingBenchmarks.filter(b => b.media_type === 'photo').length} more)</span></p>
                  {benchmarkFiles.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {benchmarkFiles.map((f, i) => (
                        <div key={i} className="relative">
                          <img src={URL.createObjectURL(f)} className="w-16 h-16 object-cover rounded-xl" alt=""/>
                          <button onClick={() => setBenchmarkFiles(prev => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => benchmarkPhotoRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 font-medium w-full justify-center">
                    📷 Add photos
                  </button>
                  <input type="file" accept="image/*" multiple className="hidden" ref={benchmarkPhotoRef}
                    onChange={e => {
                      const files = Array.from(e.target.files || [])
                      const maxNew = 5 - existingBenchmarks.filter(b => b.media_type === 'photo').length - benchmarkFiles.length
                      setBenchmarkFiles(prev => [...prev, ...files.slice(0, maxNew)])
                    }}/>
                </div>
                <div>
                  {benchmarkVideo ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center text-2xl">🎥</div>
                      <div className="flex-1"><p className="text-xs text-gray-600 truncate">{benchmarkVideo.name}</p>
                        <button onClick={() => setBenchmarkVideo(null)} className="text-xs text-red-400 font-semibold mt-0.5">Remove</button></div>
                    </div>
                  ) : !existingBenchmarks.some(b => b.media_type === 'video') ? (
                    <button onClick={() => benchmarkVideoRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 font-medium w-full justify-center">
                      🎥 Add short video
                    </button>
                  ) : null}
                  <input type="file" accept="video/*" className="hidden" ref={benchmarkVideoRef}
                    onChange={e => { if (e.target.files?.[0]) setBenchmarkVideo(e.target.files[0]) }}/>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div><p className="text-sm font-medium text-gray-700">Different per child</p><p className="text-xs text-gray-400">Each child has their own benchmark</p></div>
                  <button onClick={() => setBenchmarkDiffersPerChild(!benchmarkDiffersPerChild)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${benchmarkDiffersPerChild ? '' : 'bg-gray-200'}`}
                    style={benchmarkDiffersPerChild ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${benchmarkDiffersPerChild ? 'translate-x-6' : 'translate-x-0.5'}`}/>
                  </button>
                </div>
              </div>
            )}

            {!upForGrabs && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Assign to</p>
              <div className="grid grid-cols-4 gap-3">
                {children.map(child => {
                  const sel = assignedChildren.includes(child.id)
                  return (
                    <button key={child.id}
                      onClick={() => setAssignedChildren(prev => prev.includes(child.id) ? prev.filter(id => id !== child.id) : [...prev, child.id])}
                      className="flex flex-col items-center gap-1 active:scale-95 transition">
                      {child.avatar_url
                        ? <img src={child.avatar_url} alt={child.name} className={`w-14 h-14 rounded-full object-cover transition ${sel ? '' : 'opacity-40 grayscale'}`}
                            style={{ boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}/>
                        : <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${sel ? '' : 'opacity-40 grayscale'}`}
                            style={{ backgroundColor: child.colour + '25', boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}>
                            {child.avatar}
                          </div>}
                      <span className="text-[11px] font-bold truncate max-w-[56px]" style={{ color: sel ? child.colour : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            )}

            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={closeForm}
                className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold active:scale-95 transition">
                Cancel
              </button>
              <button onClick={saveTask} disabled={saving}
                className="flex-1 text-white font-bold py-3 rounded-2xl shadow active:scale-95 transition disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' }}>
                {saving ? 'Saving...' : editingTaskId ? 'Update Task ✓' : 'Save Task ✓'}
              </button>
            </div>
            {editingTaskId && (
              <button onClick={() => { deleteTask(editingTaskId); closeForm() }}
                className="w-full text-red-500 font-semibold py-2.5 rounded-2xl bg-red-50 active:scale-95 transition text-sm">
                🗑 Delete task
              </button>
            )}
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {mainTab === 'tasks' && !showForm && (
          <>
            <div className="flex items-center justify-between -mt-1 mb-1">
              <p className="text-[11px] text-gray-400">Tap a task to enter Kid Mode ⭐</p>
              <button onClick={() => setTodayOnly(t => !t)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition ${todayOnly ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                style={todayOnly ? { background: 'var(--theme-gradient)' } : {}}>
                📅 Today
              </button>
            </div>
            {visibleTasks.length > 0 ? (
              <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
                {visibleTasks.map(task => {
                  const assignedKids = (assignments[task.id] || []).map(id => childMap[id]).filter(Boolean)
                  return (
                    <div key={task.id} onClick={() => handleTaskClick(task)}
                      className={`rounded-2xl p-2.5 shadow-sm flex flex-col items-center gap-1.5 relative cursor-pointer active:scale-95 transition ${(task as any).up_for_grabs ? 'bg-amber-50 border-2 border-dashed border-amber-300' : 'bg-white'}`}>
                      <div className="absolute top-1.5 right-1.5 z-10">
                        <button onClick={e => { e.stopPropagation(); openEditForm(task) }} className="text-gray-300 text-xs active:scale-90 transition">✏️</button>
                      </div>
                      {(() => {
                        if ((task as any).up_for_grabs) {
                          return <span className="absolute top-1.5 left-1.5 z-10 text-[10px] w-5 h-5 rounded-md flex items-center justify-center bg-amber-100">🙌</span>
                        }
                        const f = task.frequency || 'daily'
                        const fc = f === 'weekly' ? { l: 'W', c: '#7C3AED' } : f === 'monthly' ? { l: 'M', c: '#F59E0B' } : { l: 'D', c: '#1E88E5' }
                        return <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-black w-5 h-5 rounded-md flex items-center justify-center"
                          style={{ color: fc.c, backgroundColor: fc.c + '22' }}>{fc.l}</span>
                      })()}
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl mt-1"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--theme-from) 14%, white)' }}>
                        {task.emoji}
                      </div>
                      <p className="text-xs font-bold text-gray-700 text-center leading-tight line-clamp-2">{task.title}</p>
                      <p className="text-xs text-yellow-500 font-bold">⭐ {task.star_value}</p>
                      {task.requires_benchmark_photo && <span className="text-[9px] bg-purple-50 text-purple-400 font-semibold px-1 py-0.5 rounded-full">AI check</span>}
                      {(task as any).requires_approval && <span className="text-[9px] bg-amber-50 text-amber-500 font-semibold px-1 py-0.5 rounded-full">🕓 OK</span>}
                      <div className="flex -space-x-1.5 justify-center">
                        {assignedKids.map(child => (
                          child.avatar_url
                            ? <img key={child.id} src={child.avatar_url} className="w-6 h-6 rounded-full object-cover border-2 border-white" alt=""/>
                            : <div key={child.id} className="w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 border-white"
                                style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-gray-500 font-medium">{todayOnly ? 'No tasks due today' : 'No tasks yet'}</p>
                <p className="text-gray-400 text-sm mt-1">{todayOnly ? 'Toggle Today off to see all tasks' : 'Tap the + to get started'}</p>
              </div>
            )}
          </>
        )}

        {/* ── UPCOMING TAB ── today + next 2 weeks, load earlier up to a week back ── */}
        {mainTab === 'upcoming' && !showForm && (() => {
          const compKey = new Set(windowComps.map(c => `${c.task_id}|${c.child_id}|${c.date}`))
          const compRow = new Map(windowComps.map(c => [`${c.task_id}|${c.child_id}|${c.date}`, c]))
          const todayL = ymdLocal(new Date())
          const kidSelected = (id: string) => upcomingFilter.size === 0 || upcomingFilter.has(id)
          const singleChildId = upcomingFilter.size === 1 ? [...upcomingFilter][0] : null
          const singleChild = singleChildId ? childMap[singleChildId] : null

          const days: { ds: string; d: Date; items: { task: Task; kids: Child[] }[] }[] = []
          const start = new Date(); start.setDate(start.getDate() - pastWindow)
          const end = new Date(); end.setDate(end.getDate() + 14)
          for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const ds = ymdLocal(d)
            const items = tasks
              .filter(t => occursOn(t as any, d))
              .map(t => ({
                task: t,
                kids: (assignments[t.id] || []).map(id => childMap[id]).filter(Boolean).filter(k => kidSelected(k.id)),
              }))
              .filter(x => x.kids.length > 0)
              .sort((a, b) => (UP_TIME_ORDER[a.task.time_of_day ?? ''] ?? 0) - (UP_TIME_ORDER[b.task.time_of_day ?? ''] ?? 0))
            if (items.length) days.push({ ds, d: new Date(d), items })
          }

          return (
            <div className="space-y-4">
              {/* Child filter — All + up to 3 fit the width, scroll for more */}
              {children.length > 0 && (
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                  <button onClick={() => setUpcomingFilter(new Set())}
                    className="flex flex-col items-center gap-1 active:scale-95 transition flex-shrink-0"
                    style={{ width: 'calc((100% - 1rem) / 3)' }}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black ${upcomingFilter.size === 0 ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                      style={upcomingFilter.size === 0 ? { background: 'var(--theme-gradient)', boxShadow: '0 0 0 3px white, 0 0 0 5px var(--theme-from)' } : {}}>All</div>
                    <span className="text-[11px] font-bold" style={{ color: upcomingFilter.size === 0 ? 'var(--theme-from)' : '#9ca3af' }}>Everyone</span>
                  </button>
                  {children.map(child => {
                    const sel = kidSelected(child.id)
                    const isAll = upcomingFilter.size === 0
                    return (
                      <button key={child.id} onClick={() => toggleUpcomingChild(child.id)}
                        className="flex flex-col items-center gap-1 active:scale-95 transition flex-shrink-0"
                        style={{ width: 'calc((100% - 1rem) / 3)' }}>
                        {child.avatar_url
                          ? <img src={child.avatar_url} className={`w-12 h-12 rounded-full object-cover transition ${sel ? '' : 'opacity-40 grayscale'}`}
                              style={{ boxShadow: sel && !isAll ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }} alt=""/>
                          : <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition ${sel ? '' : 'opacity-40 grayscale'}`}
                              style={{ backgroundColor: child.colour + '25', boxShadow: sel && !isAll ? `0 0 0 3px white, 0 0 0 5px ${child.colour}` : 'none' }}>{child.avatar}</div>}
                        <span className="text-[11px] font-bold truncate max-w-[64px]" style={{ color: sel && !isAll ? child.colour : '#9ca3af' }}>{child.name.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {singleChildId && (
                <p className="text-[11px] text-center text-gray-400">Tap COMPLETE to tick a task off</p>
              )}

              {/* Load earlier days (up to a week back) */}
              {pastWindow < 7 && (
                <button onClick={() => setPastWindow(w => Math.min(7, w + 3))}
                  className="w-full text-xs font-bold text-gray-400 py-2 rounded-xl bg-gray-50 active:scale-95 transition">
                  ↑ Load earlier days
                </button>
              )}

              {/* Up for grabs — unassigned bounties, first done wins */}
              {(() => {
                const claimMap = new Map(ufgClaims.map(c => [c.task_id, c]))
                const ufgList = tasks.filter((t: any) => t.up_for_grabs && (!t.expires_on || t.expires_on >= todayL))
                if (!ufgList.length) return null
                return (
                  <div>
                    <p className="text-2xl font-black mb-2 px-1 leading-none text-amber-500">🙌 Up for Grabs</p>
                    <div className="space-y-2">
                      {ufgList.map(task => {
                        const claim = claimMap.get(task.id)
                        const claimer = claim ? childMap[claim.child_id] : null
                        return (
                          <div key={task.id}
                            onClick={() => { if (!claim && !singleChildId) openTaskForChild(task) }}
                            className={`rounded-2xl p-3 shadow-sm flex items-center gap-3 border-2 border-dashed border-amber-300 bg-amber-50 ${!claim && !singleChildId ? 'cursor-pointer active:scale-[0.98]' : ''} ${claim ? 'opacity-75' : ''}`}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-white" style={{ border: '1.5px solid #F59E0B' }}>{task.emoji}</div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-base truncate ${claim ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                              <p className="text-sm font-semibold text-amber-600">
                                {claim
                                  ? `Claimed by ${claimer?.name.split(' ')[0] || '—'}`
                                  : `Anyone can claim · ⭐ ${task.star_value}${(task as any).expires_on ? ` · ends ${new Date((task as any).expires_on + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}`}
                              </p>
                            </div>
                            {claim ? (
                              <button title="Undo claim" onClick={e => { e.stopPropagation(); undoUpcoming(claim, task, claimer?.name.split(' ')[0] || '') }}
                                className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold flex-shrink-0 text-lg active:scale-90 transition">✓</button>
                            ) : singleChildId ? (
                              <button onClick={e => { e.stopPropagation(); completeUpcoming(task, singleChildId, todayL, singleChild || undefined) }}
                                className="flex-shrink-0 px-4 py-2 rounded-xl text-white font-black text-sm shadow-sm active:scale-90 transition"
                                style={{ background: '#F59E0B' }}>DONE</button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {days.length === 0 ? (
                <div className="text-center py-16"><div className="text-6xl mb-4">📅</div><p className="text-gray-500 font-medium">No upcoming tasks</p></div>
              ) : days.map(({ ds, d, items }) => {
                const isToday = ds === todayL
                const isPast = ds < todayL
                return (
                  <div key={ds} id={`up-${ds}`} className="scroll-mt-2">
                    <p className={`text-2xl font-black mb-2 px-1 leading-none ${isToday ? '' : isPast ? 'text-gray-400' : 'text-gray-700'}`}
                      style={isToday ? { color: 'var(--theme-from)' } : {}}>
                      {isToday ? 'Today' : d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}{isPast ? ' (past)' : ''}
                    </p>
                    <div className="space-y-2">
                      {items.map(({ task, kids }) => {
                        const doneCount = kids.filter(k => compKey.has(`${task.id}|${k.id}|${ds}`)).length
                        const allDone = kids.length > 0 && doneCount === kids.length
                        const missed = isPast && doneCount === 0
                        const singleDone = singleChildId ? compKey.has(`${task.id}|${singleChildId}|${ds}`) : false
                        const struck = singleChildId ? singleDone : allDone
                        return (
                          <div key={task.id}
                            onClick={() => { if (!singleChildId) openTaskForChild(task) }}
                            className={`rounded-2xl p-3 shadow-sm flex items-center gap-3 border ${!singleChildId ? 'cursor-pointer active:scale-[0.98]' : ''} ${struck ? 'bg-gray-50 border-gray-100' : missed ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-white border-gray-100'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-white ${missed ? 'grayscale opacity-50' : ''}`}
                              style={{ border: '1.5px solid var(--theme-from)' }}>{task.emoji}</div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-base truncate ${struck ? 'line-through text-gray-400' : missed ? 'text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                              <p className="text-sm text-gray-400">{task.time_of_day || 'Anytime'} · ⭐ {task.star_value}</p>
                            </div>

                            {singleChildId ? (
                              singleDone ? (
                                <button title="Undo" onClick={e => { e.stopPropagation(); const row = compRow.get(`${task.id}|${singleChildId}|${ds}`); if (row) undoUpcoming(row, task, singleChild?.name.split(' ')[0] || '') }}
                                  className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold flex-shrink-0 text-lg active:scale-90 transition">✓</button>
                              ) : (ds > todayL && !((task as any).can_do_early ?? true)) ? (
                                // Future task that can't be done early — match the kid zone
                                <div className="flex-shrink-0 text-[11px] font-semibold text-gray-300 text-center leading-tight px-1">not<br/>yet</div>
                              ) : (ds < todayL && !((task as any).carry_over ?? true)) ? (
                                // Missed past day that doesn't carry over — expired
                                <div className="flex-shrink-0 text-[11px] font-semibold text-gray-300 text-center leading-tight px-1">missed</div>
                              ) : (
                                <button onClick={e => { e.stopPropagation(); completeUpcoming(task, singleChildId, ds, singleChild || undefined) }}
                                  className="flex-shrink-0 px-4 py-2 rounded-xl text-white font-black text-sm shadow-sm active:scale-90 transition"
                                  style={{ background: 'var(--theme-gradient)' }}>DONE</button>
                              )
                            ) : (
                              <div className="flex gap-1 flex-wrap justify-end max-w-[92px]">
                                {kids.map(child => {
                                  const done = compKey.has(`${task.id}|${child.id}|${ds}`)
                                  return (
                                    <div key={child.id} className="relative flex-shrink-0" title={child.name.split(' ')[0]}>
                                      {child.avatar_url
                                        ? <img src={child.avatar_url} className={`w-8 h-8 rounded-full object-cover ${done ? '' : 'opacity-50'}`} alt=""/>
                                        : <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${done ? '' : 'opacity-50'}`}
                                            style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>}
                                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${done ? 'bg-green-500' : 'bg-gray-200'}`}>
                                        {done && <span className="text-white text-[8px] font-bold">✓</span>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* ── DONE / HISTORY TAB — grouped by child, collapsible ── */}
        {mainTab === 'history' && !showForm && (
          <div className="space-y-3">
            {children.length === 0 || history.length === 0 ? (
              <div className="text-center py-16"><div className="text-6xl mb-4">✅</div><p className="text-gray-500 font-medium">No completed tasks yet</p></div>
            ) : children.map(child => {
              const items = history.filter(h => h.child_id === child.id)
              if (items.length === 0) return null
              const open = expandedDoneChild === child.id
              const fmtDate = (iso: string) => {
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
                if (iso === todayStr) return 'Today'
                if (iso === yesterday) return 'Yesterday'
                return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
              }
              return (
                <div key={child.id} className="bg-white rounded-3xl shadow-sm overflow-hidden">
                  <button onClick={() => setExpandedDoneChild(open ? null : child.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition">
                    {child.avatar_url
                      ? <img src={child.avatar_url} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt=""/>
                      : <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                          style={{ backgroundColor: child.colour + '33' }}>{child.avatar}</div>}
                    <p className="font-bold text-gray-800 flex-1 text-left">{child.name.split(' ')[0]}</p>
                    <span className="text-xs font-semibold text-gray-400">{items.length} tasks done</span>
                    <span className={`text-gray-300 text-lg transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-3 space-y-2">
                      {items.map(h => (
                        <div key={h.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
                          <span className="text-xl">{h.tasks?.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{h.tasks?.title}</p>
                            <p className="text-xs text-gray-400">{fmtDate(h.date)} · <span className="text-yellow-500 font-semibold">+{h.tasks?.star_value} ⭐</span></p>
                          </div>
                          <button onClick={() => undoCompletion(h)}
                            className="text-xs text-gray-300 hover:text-red-400 font-semibold transition px-2 py-1 rounded-lg hover:bg-red-50 flex-shrink-0">Undo</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {burst && <CelebrationBurst colour={burst.colour} emoji={burst.emoji} title={burst.title} sub={burst.sub} onDone={() => setBurst(null)} />}

      {/* Large + FAB — add a task / reward */}
      {!showForm && (
        <button onClick={openNewForm} aria-label="Add task"
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition z-40"
          style={{ background: 'var(--theme-gradient)' }}>
          <span className="text-3xl leading-none mb-0.5">+</span>
        </button>
      )}

      {/* Jump-to-today FAB (Upcoming tab) — calendar showing today's date */}
      {!showForm && mainTab === 'upcoming' && (
        <button aria-label="Jump to today"
          onClick={() => { const el = document.getElementById(`up-${ymdLocal(new Date())}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
          className="fixed bottom-24 left-5 w-14 h-14 rounded-full bg-white shadow-xl border-2 flex flex-col items-center justify-center active:scale-90 transition z-40"
          style={{ borderColor: 'var(--theme-from)' }}>
          <span className="text-[8px] font-black leading-none mt-1" style={{ color: 'var(--theme-from)' }}>{new Date().toLocaleDateString('en-AU', { month: 'short' }).toUpperCase()}</span>
          <span className="text-xl font-black leading-none" style={{ color: 'var(--theme-from)' }}>{new Date().getDate()}</span>
        </button>
      )}

      {/* Child picker — shown when tapping a task with no kid filter selected */}
      {showChildPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => { setShowChildPicker(false); setPendingTaskId(null) }}>
          <div className="bg-white w-full rounded-t-3xl p-5 pop-in" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
            <h3 className="font-black text-gray-800 text-lg mb-1">Who's doing this? ⭐</h3>
            <p className="text-gray-400 text-sm mb-4">Tap a child to enter their zone</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {(pendingTaskId && (assignments[pendingTaskId] || []).length
                ? (assignments[pendingTaskId] || []).map(id => childMap[id]).filter(Boolean)
                : children /* up-for-grabs tasks have no assignments — anyone can take them */
              ).map(child => (
                <button key={child.id} onClick={() => router.push(`/kid-mode/${child.id}${pendingTaskId ? `?task=${pendingTaskId}` : ''}`)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl active:scale-95 transition">
                  {child.avatar_url
                    ? <img src={child.avatar_url} className="w-16 h-16 rounded-2xl object-cover" style={{ border: `3px solid ${child.colour}` }} alt=""/>
                    : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ backgroundColor: child.colour + '25', border: `3px solid ${child.colour}40` }}>{child.avatar}</div>}
                  <span className="text-xs font-bold text-gray-700 truncate max-w-full">{child.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowChildPicker(false); setPendingTaskId(null) }}
              className="w-full text-gray-500 font-semibold py-3 rounded-2xl border border-gray-200 active:scale-95 transition">
              ← Back to tasks
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
