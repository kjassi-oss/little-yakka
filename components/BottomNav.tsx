'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setTimezone } from '@/app/actions/setTimezone'

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

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
          <span className="text-2xl">📋</span>
          <span className="text-[10px] font-semibold">Tasks</span>
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

        <Link href="/dashboard/report"
          className={`flex flex-col items-center gap-1 transition ${active('/dashboard/report') ? '' : 'text-gray-400'}`}
          style={active('/dashboard/report') ? { color: 'var(--theme-from)' } : {}}>
          <span className="text-2xl">🏆</span>
          <span className="text-[10px] font-semibold">Summary</span>
        </Link>
      </div>
    </nav>
  )
}
