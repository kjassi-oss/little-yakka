'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BottomNav() {
  const pathname = usePathname()
  const active = (path: string, exact = false) =>
    exact ? pathname === path : pathname.startsWith(path)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    loadPendingRedemptions()
  }, [pathname])

  async function loadPendingRedemptions() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: guardian } = await supabase
      .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
    if (!guardian) return
    const { data: children } = await supabase
      .from('children').select('id').eq('family_id', guardian.family_id)
    if (!children?.length) return
    const { count } = await supabase
      .from('redemptions').select('id', { count: 'exact', head: true })
      .eq('status', 'requested')
      .in('child_id', children.map(c => c.id))
    setPendingCount(count || 0)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50">
      <div className="flex items-end justify-around px-2 pt-3 pb-5 max-w-sm mx-auto">
        <Link href="/dashboard"
          className={`flex flex-col items-center gap-1 transition ${active('/dashboard', true) ? '' : 'text-gray-400'}`}
          style={active('/dashboard', true) ? { color: 'var(--theme-from)' } : {}}>
          <span className="text-2xl">🏠</span>
          <span className="text-[10px] font-semibold">Home</span>
        </Link>

        <Link href="/dashboard/chores"
          className={`flex flex-col items-center gap-1 transition ${active('/dashboard/chores') ? '' : 'text-gray-400'}`}
          style={active('/dashboard/chores') ? { color: 'var(--theme-from)' } : {}}>
          <span className="text-2xl">✅</span>
          <span className="text-[10px] font-semibold">Tasks</span>
        </Link>

        <Link href="/kid-mode" className="flex flex-col items-center gap-1 -translate-y-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--theme-from, #7C3AED), var(--theme-to, #EC4899))' }}>
            <span className="text-3xl">⭐</span>
          </div>
          <span className="text-[10px] font-semibold" style={{ color: 'var(--theme-from)' }}>Kid Mode</span>
        </Link>

        <Link href="/dashboard/rewards"
          className={`flex flex-col items-center gap-1 transition relative ${active('/dashboard/rewards') ? '' : 'text-gray-400'}`}
          style={active('/dashboard/rewards') ? { color: 'var(--theme-from)' } : {}}>
          <div className="relative">
            <span className="text-2xl">🎁</span>
            {pendingCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[9px] font-black">{pendingCount > 9 ? '9+' : pendingCount}</span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-semibold">Rewards</span>
        </Link>

        <Link href="/dashboard/settings"
          className={`flex flex-col items-center gap-1 transition ${active('/dashboard/settings') ? '' : 'text-gray-400'}`}
          style={active('/dashboard/settings') ? { color: 'var(--theme-from)' } : {}}>
          <span className="text-2xl">⚙️</span>
          <span className="text-[10px] font-semibold">Settings</span>
        </Link>
      </div>
    </nav>
  )
}
