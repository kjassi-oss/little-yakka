'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50">
      <div className="flex items-end justify-around px-6 pt-3 pb-5 max-w-sm mx-auto">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-1 transition ${pathname === '/dashboard' ? 'text-purple-600' : 'text-gray-400'}`}
        >
          <span className="text-2xl">🏠</span>
          <span className="text-xs font-semibold">Home</span>
        </Link>

        <Link
          href="/dashboard/chores"
          className={`flex flex-col items-center gap-1 transition ${pathname.startsWith('/dashboard/chores') ? 'text-purple-600' : 'text-gray-400'}`}
        >
          <span className="text-2xl">✅</span>
          <span className="text-xs font-semibold">Tasks</span>
        </Link>

        <Link href="/kid-mode" className="flex flex-col items-center gap-1 -translate-y-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <span className="text-3xl">⭐</span>
          </div>
          <span className="text-xs font-semibold text-purple-600">Kid Mode</span>
        </Link>

        <Link
          href="/dashboard/rewards"
          className={`flex flex-col items-center gap-1 transition ${pathname.startsWith('/dashboard/rewards') ? 'text-purple-600' : 'text-gray-400'}`}
        >
          <span className="text-2xl">🎁</span>
          <span className="text-xs font-semibold">Rewards</span>
        </Link>

        <Link
          href="/dashboard/progress"
          className={`flex flex-col items-center gap-1 transition ${pathname.startsWith('/dashboard/progress') ? 'text-purple-600' : 'text-gray-400'}`}
        >
          <span className="text-2xl">📊</span>
          <span className="text-xs font-semibold">Progress</span>
        </Link>
      </div>
    </nav>
  )
}
