'use client'

// Shared "upcoming tasks" view — the single source of truth for the day-grouped task
// list used on the Tasks page (Upcoming tab), the Home page (short preview), and the
// Kids Zone. Pages pass their data + action callbacks; this owns the grouping + layout
// so all three look and behave identically.
import { occursOn } from '@/lib/recurrence'

export interface UTask {
  id: string; title: string; emoji: string; star_value: number
  time_of_day: string | null
  [k: string]: any
}
export interface UChild { id: string; name: string; avatar: string; colour: string; avatar_url?: string }
export interface UComp { id: string; task_id: string; child_id: string; date: string }

const UP_TIME_ORDER: Record<string, number> = { morning: 1, afternoon: 2, evening: 3 }
function ymdLocal(d: Date): string { return new Intl.DateTimeFormat('en-CA').format(d) }

interface Props {
  tasks: UTask[]
  childrenList: UChild[]
  childMap: Record<string, UChild>
  assignments: Record<string, string[]>
  windowComps: UComp[]
  ufgClaims: UComp[]
  upcomingFilter: Set<string>
  setUpcomingFilter: (s: Set<string>) => void
  toggleUpcomingChild: (id: string) => void
  pastWindow: number
  setPastWindow: (fn: (w: number) => number) => void
  daysAhead?: number
  showChildFilter?: boolean
  showPastWindow?: boolean
  singleChildId?: string | null
  // Loose task types so callers can pass their own stricter Task shape without friction.
  onOpenTask: (task: any) => void
  onComplete: (task: any, childId: string, date: string, child?: any) => void
  onUndo: (comp: { id: string; child_id: string }, task: any, childName: string) => void
}

export default function UpcomingTaskList({
  tasks, childrenList, childMap, assignments, windowComps, ufgClaims,
  upcomingFilter, setUpcomingFilter, toggleUpcomingChild, pastWindow, setPastWindow,
  daysAhead = 14, showChildFilter = true, showPastWindow = true, singleChildId = null,
  onOpenTask, onComplete, onUndo,
}: Props) {
  const compKey = new Set(windowComps.map(c => `${c.task_id}|${c.child_id}|${c.date}`))
  const compRow = new Map(windowComps.map(c => [`${c.task_id}|${c.child_id}|${c.date}`, c]))
  const todayL = ymdLocal(new Date())
  const carryCutoff = ymdLocal(new Date(Date.now() - 7 * 86400000)) // carry-over occurrences expire after 7 days
  const kidSelected = (id: string) => upcomingFilter.size === 0 || upcomingFilter.has(id)
  const singleChild = singleChildId ? childMap[singleChildId] : null

  const days: { ds: string; d: Date; items: { task: UTask; kids: UChild[] }[] }[] = []
  const start = new Date(); start.setDate(start.getDate() - pastWindow)
  const end = new Date(); end.setDate(end.getDate() + daysAhead)
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
    <div className="space-y-2">
      {showChildFilter && childrenList.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
          <button onClick={() => setUpcomingFilter(new Set())}
            className="flex flex-col items-center gap-1 active:scale-95 transition flex-shrink-0"
            style={{ width: 'calc((100% - 1.5rem) / 4)' }}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black ${upcomingFilter.size === 0 ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
              style={upcomingFilter.size === 0 ? { background: 'var(--theme-gradient)', boxShadow: '0 0 0 3px white, 0 0 0 5px var(--theme-from)' } : {}}>All</div>
            <span className="text-[11px] font-bold" style={{ color: upcomingFilter.size === 0 ? 'var(--theme-from)' : '#9ca3af' }}>Everyone</span>
          </button>
          {childrenList.map(child => {
            const sel = kidSelected(child.id)
            const isAll = upcomingFilter.size === 0
            return (
              <button key={child.id} onClick={() => toggleUpcomingChild(child.id)}
                className="flex flex-col items-center gap-1 active:scale-95 transition flex-shrink-0"
                style={{ width: 'calc((100% - 1.5rem) / 4)' }}>
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
        <p className="text-[11px] text-center text-gray-400">Tap DONE to tick a task off</p>
      )}

      {showPastWindow && pastWindow < 30 && (
        <button onClick={() => setPastWindow(w => Math.min(30, w + 7))}
          className="w-full text-[11px] font-bold text-gray-400 py-0.5 active:scale-95 transition">
          ↑ Load earlier days
        </button>
      )}

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
                    onClick={() => { if (!claim && !singleChildId) onOpenTask(task) }}
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
                      <button title="Undo claim" onClick={e => { e.stopPropagation(); onUndo(claim, task, claimer?.name.split(' ')[0] || '') }}
                        className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold flex-shrink-0 text-lg active:scale-90 transition">✓</button>
                    ) : singleChildId ? (
                      <button onClick={e => { e.stopPropagation(); onComplete(task, singleChildId, todayL, singleChild || undefined) }}
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
                    onClick={() => { if (!singleChildId) onOpenTask(task) }}
                    className={`rounded-2xl p-3 shadow-sm flex items-center gap-3 border ${!singleChildId ? 'cursor-pointer active:scale-[0.98]' : ''} ${struck ? 'bg-gray-50 border-gray-100' : missed ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-white border-gray-100'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-white ${missed ? 'grayscale opacity-50' : ''}`}
                      style={{ border: '1.5px solid var(--theme-from)' }}>{task.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-base truncate ${struck ? 'line-through text-gray-400' : missed ? 'text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                      <p className="text-sm text-gray-400">{task.time_of_day || 'Anytime'} · ⭐ {task.star_value}</p>
                    </div>

                    {singleChildId ? (
                      singleDone ? (
                        <button title="Undo" onClick={e => { e.stopPropagation(); const row = compRow.get(`${task.id}|${singleChildId}|${ds}`); if (row) onUndo(row, task, singleChild?.name.split(' ')[0] || '') }}
                          className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold flex-shrink-0 text-lg active:scale-90 transition">✓</button>
                      ) : (ds > todayL && !((task as any).can_do_early ?? true)) ? (
                        <div className="flex-shrink-0 text-[11px] font-semibold text-gray-300 text-center leading-tight px-1">not<br/>yet</div>
                      ) : (ds < todayL && (!((task as any).carry_over ?? true) || ds < carryCutoff)) ? (
                        <div className="flex-shrink-0 text-[11px] font-semibold text-gray-300 text-center leading-tight px-1">{((task as any).carry_over ?? true) ? 'expired' : 'missed'}</div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); onComplete(task, singleChildId, ds, singleChild || undefined) }}
                          className="flex-shrink-0 px-4 py-2 rounded-xl text-white font-black text-sm shadow-sm active:scale-90 transition"
                          style={{ background: 'var(--theme-gradient)' }}>DONE</button>
                      )
                    ) : (
                      <div className="flex gap-1 justify-end flex-shrink-0">
                        {kids.slice(0, 3).map(child => {
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
}
