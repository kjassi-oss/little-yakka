'use client'

// Home page's task section: the SAME shared UpcomingTaskList as the Tasks page, but
// limited to the next 2 days, no child filter (the kid tiles above serve that), and a
// "Show all tasks" button into the full Tasks page. Home is a server component, so this
// client wrapper supplies the interactive navigation.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UpcomingTaskList, { type UChild, type UComp } from './UpcomingTaskList'

export default function HomeTaskPreview({ tasks, childrenList, assignments, windowComps }: {
  tasks: any[]; childrenList: UChild[]; assignments: Record<string, string[]>; windowComps: UComp[]
}) {
  const router = useRouter()
  const childMap: Record<string, UChild> = Object.fromEntries(childrenList.map(c => [c.id, c]))
  const noop = () => {}
  // Task assigned to several kids → ask whose zone to open
  const [pickerTask, setPickerTask] = useState<any | null>(null)

  const openTask = (task: any) => {
    const kids = assignments[task.id] || []
    if (kids.length === 1) router.push(`/kid-mode/${kids[0]}?task=${task.id}`)
    else if (kids.length > 1) setPickerTask(task)
    else router.push('/dashboard/chores')
  }

  return (
    <div className="space-y-3">
      <UpcomingTaskList
        tasks={tasks} childrenList={childrenList} childMap={childMap} assignments={assignments}
        windowComps={windowComps} ufgClaims={[]}
        upcomingFilter={new Set()} setUpcomingFilter={noop} toggleUpcomingChild={noop}
        pastWindow={0} setPastWindow={noop}
        daysAhead={2} showChildFilter={false} showPastWindow={false} showUpForGrabs={false}
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
            <div className="text-4xl mb-1">{pickerTask.emoji}</div>
            <h3 className="text-lg font-black text-gray-800 mb-3">Whose Kids Zone?</h3>
            <div className="flex justify-center gap-4">
              {(assignments[pickerTask.id] || []).map(kidId => {
                const kid = childMap[kidId]
                if (!kid) return null
                return (
                  <button key={kidId} onClick={() => { setPickerTask(null); router.push(`/kid-mode/${kidId}?task=${pickerTask.id}`) }}
                    className="flex flex-col items-center gap-1.5 active:scale-95 transition">
                    {kid.avatar_url
                      ? <img src={kid.avatar_url} className="w-14 h-14 rounded-full object-cover" style={{ border: `3px solid ${kid.colour}` }} alt=""/>
                      : <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: kid.colour + '33', border: `3px solid ${kid.colour}` }}>{kid.avatar}</div>}
                    <span className="text-xs font-bold text-gray-600">{kid.name.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setPickerTask(null)} className="mt-4 text-gray-400 text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
