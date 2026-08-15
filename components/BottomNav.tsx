'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setTimezone } from '@/app/actions/setTimezone'
import { navColour, HomeIcon, TasksIcon, CalendarIcon, RewardsIcon, SummaryIcon } from './NavIcons'

export default function BottomNav() {
  const pathname = usePathname()
  const active = (path: string, exact = false) =>
    exact ? pathname === path : pathname.startsWith(path)
  const [pendingCount, setPendingCount] = useState(0)
  const [approvalCount, setApprovalCount] = useState(0)

  useEffect(() => {
    // Auto-set timezone cookie if not already present
    const hasTz = document.cookie.split(';').some(s => s.trim().startsWith('tz='))
    if (!hasTz) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Sydney'
      setTimezone(tz)
    }
    loadBadges()
  }, [pathname])

  async function loadBadges() {
    const supabase = createClient()
    // getSession reads local storage (no network); RLS scopes both counts to
    // this family, so no guardian/children lookups are needed — 1 round trip.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const [{ count: redeemCount }, { count: approveCount }] = await Promise.all([
      supabase.from('redemptions').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
      supabase.from('completions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setPendingCount(redeemCount || 0)
    setApprovalCount(approveCount || 0)
  }

  const items = [
    { href: '/dashboard', label: 'Home', Icon: HomeIcon, colour: navColour.home, exact: true },
    { href: '/dashboard/chores', label: 'Tasks', Icon: TasksIcon, colour: navColour.tasks },
    { href: '/dashboard/calendar', label: 'Calendar', Icon: CalendarIcon, colour: navColour.calendar },
    { href: '/dashboard/rewards', label: 'Rewards', Icon: RewardsIcon, colour: navColour.rewards, badge: pendingCount },
    { href: '/dashboard/report', label: 'Summary', Icon: SummaryIcon, colour: navColour.summary },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-end justify-around px-2 pt-2.5 pb-4 max-w-sm mx-auto">
        {items.map(({ href, label, Icon, colour, exact, badge }) => {
          const on = active(href, exact)
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1.5 transition">
              <div className="relative">
                {/* Sticker badge: solid section colour when active, a 12% tint when not */}
                <span className="w-9 h-9 rounded-xl flex items-center justify-center transition"
                  style={{ background: on ? colour : `${colour}1F`, color: on ? '#fff' : colour }}>
                  <Icon className="w-5 h-5" />
                </span>
                {!!badge && badge > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[9px] font-black">{badge > 9 ? '9+' : badge}</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] font-semibold" style={{ color: on ? colour : '#8C93AB' }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
