'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// Renders the "SPIN READY!" link, but decides availability on the CLIENT against
// the real current time (in the family timezone) — so it lights up on the next
// page load / navigation the moment the scheduled time passes, and refreshes
// itself every minute while the app is open. The "already spun this window"
// check stays server-computed and is passed in as `spun`.
export default function SpinReadyBadge({ childId, cadence, day, time, tz, spun }: {
  childId: string
  cadence: 'weekly' | 'monthly'
  day: number       // weekly: 0=Sun…6=Sat · monthly: date of month
  time: string      // "HH:MM"
  tz: string
  spun: boolean
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    function check() {
      if (spun) { setReady(false); return }
      // "Now" in the family timezone
      const now = new Date()
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)      // YYYY-MM-DD
      const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
      const [y, mo, dd] = todayStr.split('-').map(Number)
      const today = new Date(y, mo - 1, dd)   // local midnight — used only for day arithmetic

      // Most recent scheduled occurrence
      const start = new Date(today)
      if (cadence === 'monthly') {
        if (dd < day) start.setMonth(start.getMonth() - 1)
        start.setDate(day)
      } else {
        start.setDate(start.getDate() - ((today.getDay() - day + 7) % 7))
      }
      const diffDays = Math.round((today.getTime() - start.getTime()) / 86400000)
      const onStartDay = diffDays === 0
      // Open for 3 days from the occurrence, and (on the start day) only past the set time
      setReady(diffDays >= 0 && diffDays < 3 && (!onStartDay || hhmm >= time))
    }
    check()
    const id = setInterval(check, 60000) // re-check each minute while open
    return () => clearInterval(id)
  }, [cadence, day, time, tz, spun])

  if (!ready) return null

  return (
    <Link href={`/kid-mode/${childId}?spin=1`}
      className="block mx-2.5 mb-2.5 text-center text-[10px] font-black text-white rounded-full px-2 py-1 animate-pulse active:scale-95 transition"
      style={{ background: 'var(--theme-gradient)' }}>
      🎰 SPIN READY!
    </Link>
  )
}
