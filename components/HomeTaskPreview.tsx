'use client'

// Home page's task section: the SAME shared UpcomingTaskList as the Tasks page, but
// limited to the next 2 days, no child filter (the kid tiles above serve that), and a
// "Show all tasks" button into the full Tasks page. Home is a server component, so this
// client wrapper supplies the interactive navigation.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UpcomingTaskList, { type UChild, type UComp } from './UpcomingTaskList'

export default function HomeTaskPreview({ tasks, childrenList, assignments, windowComps, ufgClaims = [] }: {
  tasks: any[]; childrenList: UChild[]; assignments: Record<string, string[]>; windowComps: UComp[]; ufgClaims?: UComp[]
}) {
  const router = useRouter()
  const childMap: Record<string, UChild> = Object.fromEntries(childrenList.map(c => [c.id, c]))
  const noop = () => {}
  // Task assigned to several kids → ask whose zone to open (only kids who still
  // have that occurrence outstanding; if all have done it, offer everyone assigned)
  const [pickerTask, setPickerTask] = useState<{ task: any; kidIds: string[] } | null>(null)

  const openTask = (task: any, date?: string) => {
    const all = assignments[task.id] || []
    const outstanding = date
      ? all.filter(id => !windowComps.some(c => c.task_id === task.id && c.child_id === id && c.date === date))
      : all
    const kids = outstanding.length ? outstanding : all
    if (kids.length === 1) router.push(`/kid-mode/${kids[0]}?task=${task.id}`)
    else if (kids.length > 1) setPickerTask({ task, kidIds: kids })
    else router.push('/dashboard/chores')
  }

  return (
    <div className="space-y-3">
      <UpcomingTaskList
        tasks={tasks} childrenList={childrenList} childMap={childMap} assignments={assignments}
        windowComps={windowComps} ufgClaims={ufgClaims}
        upcomingFilter={new Set()} setUpcomingFilter={noop} toggleUpcomingChild={noop}
        pastWindow={0} setPastWindow={noop}
        daysAhead={2} showChildFilter={false} showPastWindow={false} showUpForGrabs={true}
        onOpenTask={openTask} onComplete={noop} onUndo={noop}
      />
      <Link href="/dashboard/chores"
        className="block w-full text-center py-3 rounded-2xl font-black text-white shadow-sm active:scale-95 transition"
        style={{ background: 'var(--theme-gradient)' }}>
        Show all tasks →
      </Link>

      {/* Whose Kids Zone? — shown when a multi-kid task is tapped */}
      {pickerTask && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-6" onClick={() => setPickerTask(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center pop-in" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-1">{pickerTask.task.emoji}</div>
            <h3 className="text-lg font-black text-gray-800 mb-3">Whose Kids Zone?</h3>
            <div className="flex justify-center gap-4 flex-wrap">
              {childrenList.filter(k => pickerTask.kidIds.includes(k.id)).map(kid => (
                  <button key={kid.id} onClick={() => { setPickerTask(null); router.push(`/kid-mode/${kid.id}?task=${pickerTask.task.id}`) }}
                    className="flex flex-col items-center gap-1.5 active:scale-95 transition">
                    {kid.avatar_url
                      ? <img src={kid.avatar_url} className="w-14 h-14 rounded-full object-cover" style={{ border: `3px solid ${kid.colour}` }} alt=""/>
                      : <div className="w-14 h-14 rounded-full flex items-center justify-center text-[36px] leading-none overflow-hidden bg-white" style={{ border: `3px solid ${kid.colour}` }}>{kid.avatar}</div>}
                    <span className="text-xs font-bold text-gray-600">{kid.name.split(' ')[0]}</span>
                  </button>
              ))}
            </div>
            <button onClick={() => setPickerTask(null)} className="mt-4 text-gray-400 text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
