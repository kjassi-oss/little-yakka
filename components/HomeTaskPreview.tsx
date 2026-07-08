'use client'

// Home page's task section: the SAME shared UpcomingTaskList as the Tasks page, but
// limited to the next 2 days, no child filter (the kid tiles above serve that), and a
// "Show all tasks" button into the full Tasks page. Home is a server component, so this
// client wrapper supplies the interactive navigation.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UpcomingTaskList, { type UChild, type UComp } from './UpcomingTaskList'

export default function HomeTaskPreview({ tasks, childrenList, assignments, windowComps }: {
  tasks: any[]; childrenList: UChild[]; assignments: Record<string, string[]>; windowComps: UComp[]
}) {
  const router = useRouter()
  const childMap: Record<string, UChild> = Object.fromEntries(childrenList.map(c => [c.id, c]))
  const noop = () => {}

  const openTask = (task: any) => {
    const kids = assignments[task.id] || []
    if (kids.length === 1) router.push(`/kid-mode/${kids[0]}?task=${task.id}`)
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
    </div>
  )
}
