'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileButton from '@/components/ProfileButton'
import { occursOn } from '@/lib/recurrence'
import LoadingLogo from '@/components/LoadingLogo'
import CelebrationBurst from '@/components/CelebrationBurst'
import { getCachedFamily } from '@/lib/familyCache'
import { completionFeedback } from '@/lib/feedback'
import UpcomingTaskList from '@/components/UpcomingTaskList'
import { TASK_PRESETS, DEFAULT_TASK_EMOJIS as DEFAULT_EMOJIS } from '@/lib/taskPresets'

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
  const [pastWindow, setPastWindow] = useState(0) // days of history shown in Upcoming (0 = today only; max 30)
  const [burst, setBurst] = useState<{ colour: string; emoji: string; title: string; sub?: string } | null>(null)
  // Themed confirmation dialog (replaces browser confirm() popups)
  const [confirmAsk, setConfirmAsk] = useState<{ emoji: string; title: string; sub: string; onConfirm: () => void } | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🧹')
  const [type, setType] = useState<'chore' | 'routine'>('chore')
  const [timeOfDay, setTimeOfDay] = useState('anytime')
  const [startDate, setStartDate] = useState('')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [emojiSearch, setEmojiSearch] = useState('')
  const [showEmojiSearch, setShowEmojiSearch] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [carryOver, setCarryOver] = useState(false)
  const [infoTip, setInfoTip] = useState<null | 'carry' | 'early'>(null)
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
  const [canDoEarly, setCanDoEarly] = useState(false)
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
    // Cached family lookup (no auth/guardian round trips), then ONE parallel
    // batch — RLS already scopes completions to this family, so the .in(child)
    // filters that forced a second stage aren't needed.
    const fam = await getCachedFamily(supabase)
    if (!fam) return
    setFamilyId(fam.familyId)

    const today = new Date().toISOString().split('T')[0]
    const winStart = new Date(); winStart.setDate(winStart.getDate() - 30)
    const [
      { data: tasksData }, { data: childrenData }, { data: assignmentsData }, { data: completionsData },
      { data: historyData }, { data: approvalData }, { data: winData },
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('family_id', fam.familyId).order('created_at'),
      supabase.from('children').select('*').eq('family_id', fam.familyId).order('name'),
      supabase.from('task_assignments').select('task_id, child_id'),
      supabase.from('completions').select('task_id, child_id, status').eq('date', today),
      supabase.from('completions')
        .select('id, date, child_id, tasks(title, emoji, star_value), children(name, avatar, colour, avatar_url)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(120),
      supabase.from('completions')
        .select('id, date, child_id, tasks(title, emoji, star_value), children(name, avatar, colour, avatar_url)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('completions')
        .select('id, task_id, child_id, date, status')
        .gte('date', ymdLocal(winStart)).lte('date', ymdLocal(new Date())),
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
    setHistory((historyData as any) || [])
    setPendingApprovals((approvalData as any) || [])
    setWindowComps((winData || []).filter(c => c.status === 'approved' || c.status === 'pending')
      .map(c => ({ id: c.id, task_id: c.task_id, child_id: c.child_id, date: c.date })))
    setPageLoading(false)

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

  function undoUpcoming(comp: { id: string; child_id: string }, task: Task, childName: string) {
    setConfirmAsk({
      emoji: task.emoji,
      title: `Undo "${task.title}"${childName ? ` for ${childName}` : ''}?`,
      sub: `This gives back ${task.star_value} ⭐`,
      onConfirm: async () => {
        setConfirmAsk(null)
        const supabase = createClient()
        await supabase.from('completions').delete().eq('id', comp.id)
        await supabase.from('star_ledger').insert({
          child_id: comp.child_id, delta: -(task.star_value || 0),
          reason: `Undo: ${task.title}`, source_type: 'undo',
        })
        loadData()
      },
    })
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
    setFrequency('daily'); setCarryOver(false); setStarValue(3)
    setStartDate(new Date().toISOString().split('T')[0])
    setRequiresPhoto(false); setRequiresBenchmarkPhoto(false)
    setBenchmarkDiffersPerChild(false); setBenchmarkFiles([]); setBenchmarkVideo(null)
    setExistingBenchmarks([]); setAssignedChildren(children.map(c => c.id)); setDifficulty('medium')
    setRequiresApproval(false); setCanDoEarly(false); setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
    setUpForGrabs(false); setExpiresOn(''); setShowPresets(false); setShowEmojiSearch(false); setEmojiSearch('')
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
    setDaysOfWeek(task.days_of_week?.length ? task.days_of_week : [0, 1, 2, 3, 4, 5, 6])
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

  function undoCompletion(row: HistoryRow) {
    setConfirmAsk({
      emoji: row.tasks?.emoji || '📋',
      title: `Undo "${row.tasks?.title}" for ${row.children?.name?.split(' ')[0] || 'this child'}?`,
      sub: `This gives back ${row.tasks?.star_value || 0} ⭐`,
      onConfirm: async () => {
        setConfirmAsk(null)
        const supabase = createClient()
        await supabase.from('completions').delete().eq('id', row.id)
        await supabase.from('star_ledger').insert({
          child_id: row.child_id,
          delta: -(row.tasks?.star_value || 0),
          reason: `Undo: ${row.tasks?.title}`,
          source_type: 'undo',
        })
        loadData()
      },
    })
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
      {/* Frozen header + sub-bars — stay pinned while the list scrolls */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
      {/* Compact header — logo left, centred title, settings right */}
      <div className="pt-14 pb-2.5 px-4 bg-white border-b border-gray-100">
        <div className="max-w-sm lg:max-w-3xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
          <img src="/logo.png" alt="Little Yakka" className="h-20 w-auto justify-self-start" onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
          <span className="text-5xl font-black justify-self-center leading-none" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tasks</span>
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
      </div>

      <div className="max-w-sm lg:max-w-3xl mx-auto px-4 mt-4 space-y-4">

        {/* Add/Edit Form — full-screen (nothing behind it) */}
        {showForm && (
          <div className="fixed inset-0 z-[60] bg-white overflow-y-auto">
          <div className="max-w-sm lg:max-w-2xl mx-auto px-4 pt-14 pb-28 space-y-4">
            <div className="relative flex items-center justify-center min-h-[44px]">
              <h2 className="text-4xl font-black leading-none text-center" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', background: 'var(--theme-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{editingTaskId ? 'Edit Task' : 'Create Task'}</h2>
              <button onClick={closeForm} aria-label="Close" className="absolute right-0 w-9 h-9 flex items-center justify-center text-3xl leading-none text-gray-400 active:scale-90 transition">×</button>
            </div>

            {/* Templates — collapsed by default; round icon + name, 4 per row */}
            {!editingTaskId && (
              <div>
                <button onClick={() => setShowPresets(s => !s)}
                  className="text-sm font-bold active:scale-95 transition" style={{ color: 'var(--theme-from)' }}>
                  {showPresets ? '× Hide templates' : '✨ Use a template'}
                </button>
                {showPresets && (
                  <div className="grid grid-cols-4 gap-2.5 mt-3">
                    {TASK_PRESETS.map(p => (
                      <button key={p.title} onClick={() => { setTitle(p.title); setEmoji(p.emoji); setShowPresets(false) }}
                        className="flex flex-col items-center gap-1 active:scale-95 transition">
                        <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl">{p.emoji}</div>
                        <span className="text-[10px] font-semibold text-gray-500 text-center leading-tight">{p.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Name with the chosen icon beside it (white bg, red border) */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-white"
                style={{ border: '2px solid #EF4444' }}>{emoji}</div>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="Task name"/>
            </div>

            {/* Icon picker — 10 defaults (5 per row); 🔍 reveals full search */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Choose an icon</p>
                <button onClick={() => setShowEmojiSearch(s => { if (s) setEmojiSearch(''); return !s })}
                  aria-label="Search icons"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition active:scale-90 ${showEmojiSearch ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                  style={showEmojiSearch ? { background: 'var(--theme-gradient)' } : {}}>🔍</button>
              </div>
              {showEmojiSearch && (
                <input type="text" value={emojiSearch} onChange={e => setEmojiSearch(e.target.value)} autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="Search icons (e.g. bed, teeth, dog)"/>
              )}
              <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-gray-50 rounded-2xl">
                {(emojiSearch.trim()
                  ? EMOJI_OPTIONS.filter(o => o.kw.includes(emojiSearch.trim().toLowerCase())).slice(0, 20).map(o => o.e)
                  : DEFAULT_EMOJIS
                ).map((e, i) => (
                  <button key={`${e}-${i}`} onClick={() => setEmoji(e)}
                    className={`text-2xl p-2 rounded-xl transition ${emoji === e ? 'ring-2 ring-purple-400 bg-white' : 'bg-white/60 hover:bg-white'}`}>
                    {e}
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

            {frequency === 'daily' && (() => {
              const allDays = daysOfWeek.length >= 7
              return (
              <div>
                <p className="text-xs text-gray-500 mb-2">Which days?</p>
                <div className="flex gap-1.5">
                  <button onClick={() => setDaysOfWeek(allDays ? [] : [0, 1, 2, 3, 4, 5, 6])}
                    className={`flex-[1.4] h-9 rounded-xl text-xs font-black transition ${allDays ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                    style={allDays ? { background: 'linear-gradient(135deg, var(--theme-from), var(--theme-to))' } : {}}>
                    All
                  </button>
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
                <p className="text-[11px] text-gray-400 mt-1">Tap <span className="font-bold">All</span> for every day, or pick specific days.</p>
              </div>
              )
            })()}
            </>)}

            {/* Time of day + start date (+ up-for-grabs expiry) on one row */}
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-2">Time of day</p>
                <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)}
                  className={`w-full border border-gray-200 rounded-2xl ${upForGrabs ? 'px-2' : 'px-3'} py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400`}>
                  {TIME_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-2">Start date</p>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className={`w-full border border-gray-200 rounded-2xl ${upForGrabs ? 'px-2' : 'px-3'} py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400`}/>
              </div>
              {upForGrabs && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-2">Expiry <span className="text-gray-300">(optional)</span></p>
                  <input type="date" value={expiresOn} onChange={e => setExpiresOn(e.target.value)}
                    className="w-full border border-gray-200 rounded-2xl px-2 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                </div>
              )}
            </div>

            {!upForGrabs && (
            <div className="flex gap-2">
              {/* Carry Over */}
              <div className="flex-1 bg-gray-50 rounded-2xl p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">Carry Over ↩️</p>
                  <button onClick={() => setInfoTip('carry')} aria-label="What is Carry Over?"
                    className="w-4 h-4 rounded-full bg-gray-300 text-white text-[10px] font-black flex items-center justify-center leading-none flex-shrink-0 active:scale-90 transition">i</button>
                </div>
                <button onClick={() => setCarryOver(!carryOver)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${carryOver ? '' : 'bg-gray-200'}`}
                  style={carryOver ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${carryOver ? 'translate-x-6' : 'translate-x-0.5'}`}/>
                </button>
              </div>
              {/* Done Early */}
              <div className="flex-1 bg-gray-50 rounded-2xl p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">Done Early 🗓️</p>
                  <button onClick={() => setInfoTip('early')} aria-label="What is Done Early?"
                    className="w-4 h-4 rounded-full bg-gray-300 text-white text-[10px] font-black flex items-center justify-center leading-none flex-shrink-0 active:scale-90 transition">i</button>
                </div>
                <button onClick={() => setCanDoEarly(!canDoEarly)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${canDoEarly ? '' : 'bg-gray-200'}`}
                  style={canDoEarly ? { background: 'linear-gradient(90deg, var(--theme-from), var(--theme-to))' } : {}}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${canDoEarly ? 'translate-x-6' : 'translate-x-0.5'}`}/>
                </button>
              </div>
            </div>
            )}

            {/* Info popup for Carry Over / Done Early */}
            {infoTip && (
              <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-6" onClick={() => setInfoTip(null)}>
                <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center pop-in" onClick={e => e.stopPropagation()}>
                  <div className="text-4xl mb-2">{infoTip === 'carry' ? '↩️' : '🗓️'}</div>
                  <h3 className="text-lg font-black text-gray-800 mb-1">{infoTip === 'carry' ? 'Carry Over' : 'Done Early'}</h3>
                  <p className="text-sm font-semibold text-gray-500 leading-snug">
                    {infoTip === 'carry'
                      ? 'Allows Task to be completed up to 3 days past its due date.'
                      : 'Allows Task to be done prior to due date.'}
                  </p>
                  <button onClick={() => setInfoTip(null)}
                    className="mt-4 w-full py-2.5 rounded-2xl text-white font-black active:scale-95 transition"
                    style={{ background: 'var(--theme-gradient)' }}>Got it!</button>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Stars to earn ⭐</p>
                <span className="font-black text-yellow-500 text-lg leading-none">{starValue} ⭐</span>
              </div>
              <input type="range" min={1} max={50} value={Math.min(starValue, 50)}
                onChange={e => setStarValue(Number(e.target.value))} className="w-full"/>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>25</span><span>50</span></div>
            </div>

            {!upForGrabs && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Assign to</p>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(children.length, 1), 4)}, minmax(0, 1fr))` }}>
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

        {/* ── UPCOMING TAB — shared component (also used on Home + Kids Zone) ── */}
        {mainTab === 'upcoming' && !showForm && (
          <UpcomingTaskList
            tasks={tasks} childrenList={children} childMap={childMap} assignments={assignments}
            windowComps={windowComps} ufgClaims={ufgClaims}
            upcomingFilter={upcomingFilter} setUpcomingFilter={setUpcomingFilter} toggleUpcomingChild={toggleUpcomingChild}
            pastWindow={pastWindow} setPastWindow={setPastWindow}
            daysAhead={14} showChildFilter showPastWindow
            onOpenTask={openTaskForChild} onComplete={completeUpcoming} onUndo={undoUpcoming}
          />
        )}

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

      {/* Themed confirmation dialog */}
      {confirmAsk && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6" onClick={() => setConfirmAsk(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl pop-in text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl bg-white"
              style={{ border: '2px solid var(--theme-from)' }}>{confirmAsk.emoji}</div>
            <h3 className="text-lg font-black text-gray-800 leading-tight mb-1">{confirmAsk.title}</h3>
            <p className="text-sm font-semibold text-gray-400 mb-5">{confirmAsk.sub}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAsk(null)}
                className="flex-1 py-3 rounded-2xl font-black text-sm text-white shadow active:scale-95 transition"
                style={{ background: 'var(--theme-gradient)' }}>
                Keep it ✓
              </button>
              <button onClick={confirmAsk.onConfirm}
                className="flex-1 py-3 rounded-2xl font-black text-sm text-gray-500 border-2 border-gray-200 bg-white active:scale-95 transition">
                Undo
              </button>
            </div>
          </div>
        </div>
      )}

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
