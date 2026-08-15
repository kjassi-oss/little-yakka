'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { navColour, HomeIcon, TasksIcon, CalendarIcon, RewardsIcon, SummaryIcon, SettingsIcon } from './NavIcons'

// Desktop-only left sidebar. Hidden on mobile (BottomNav takes over there).
export default function SideNav() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      // Local session read + RLS-scoped count — a single round trip
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { count } = await supabase.from('redemptions')
        .select('id', { count: 'exact', head: true }).eq('status', 'requested')
      setPendingCount(count || 0)
    })()
  }, [pathname])

  const items = [
    { href: '/dashboard', label: 'Home', Icon: HomeIcon, colour: navColour.home, exact: true },
    { href: '/dashboard/chores', label: 'Tasks', Icon: TasksIcon, colour: navColour.tasks },
    { href: '/dashboard/calendar', label: 'Calendar', Icon: CalendarIcon, colour: navColour.calendar },
    { href: '/dashboard/rewards', label: 'Rewards', Icon: RewardsIcon, colour: navColour.rewards, badge: pendingCount },
    { href: '/dashboard/report', label: 'Summary', Icon: SummaryIcon, colour: navColour.summary },
    { href: '/dashboard/settings', label: 'Settings', Icon: SettingsIcon, colour: navColour.settings },
  ]
  const isActive = (href: string, exact = false) => exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-56 flex-col bg-white border-r border-gray-100 p-4 z-40">
      <img src="/logo.png" alt="Little Yakka" className="h-16 w-auto mx-auto mb-6"/>
      <nav className="flex flex-col gap-1">
        {items.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition ${active ? 'text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
              style={active ? { background: 'var(--theme-gradient)' } : {}}>
              {/* On the active row the badge sits on the theme gradient, so it
                  goes translucent-white instead of its own colour */}
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={active
                  ? { background: 'rgba(255,255,255,0.22)', color: '#fff' }
                  : { background: `${item.colour}1F`, color: item.colour }}>
                <item.Icon className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1">{item.label}</span>
              {!!item.badge && item.badge > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
