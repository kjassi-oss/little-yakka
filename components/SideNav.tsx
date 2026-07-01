'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Desktop-only left sidebar. Hidden on mobile (BottomNav takes over there).
export default function SideNav() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: guardian } = await supabase
        .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
      if (!guardian) return
      const { data: children } = await supabase
        .from('children').select('id').eq('family_id', guardian.family_id)
      if (!children?.length) return
      const { count } = await supabase.from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'requested').in('child_id', children.map(c => c.id))
      setPendingCount(count || 0)
    })()
  }, [pathname])

  const items = [
    { href: '/dashboard', label: 'Home', icon: '🏠', exact: true },
    { href: '/dashboard/chores', label: 'Tasks', icon: '📋' },
    { href: '/dashboard/rewards', label: 'Rewards', icon: '🎁', badge: pendingCount },
    { href: '/dashboard/report', label: 'Summary', icon: '🏆' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
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
              <span className="text-xl">{item.icon}</span>
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
