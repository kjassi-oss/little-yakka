'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { markDataChanged, lastDataChange } from '@/lib/dataChanged'

// Keeps every page showing current data. Two jobs, both living in the dashboard
// layout so they survive tab navigation:
//
// 1. LIVE SYNC — when the database changes (this device, the co-parent's phone,
//    a kid's tablet), re-fetch the current server-rendered page.
// 2. STALE-ROUTE REPAIR — `router.refresh()` only clears the client Router Cache
//    for the route you're standing on, and `staleTimes.dynamic` keeps the others
//    around for a while. So we also remember when data last changed and refresh
//    any route we navigate to whose cached copy is older than that. Without this,
//    deleting a child in Settings left them on Home until the cache expired.
//
// Scoped to this family. Unfiltered, every open page in the app got a callback
// evaluated for EVERY family's writes, so server work grew as
// (writes x concurrent clients) — fine at 20 families, not at 1000. The
// completions/star_ledger/redemptions tables have no family_id, so those filter
// on child_id instead.
export default function RealtimeRefresh({ familyId, childIds }: { familyId: string; childIds: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  // Primitive dep: the array identity changes every render, the string doesn't.
  const ids = childIds.join(',')
  // When we last re-fetched each route, so we refresh it at most once per change.
  const refreshedAt = useRef<Record<string, number>>({})

  useEffect(() => {
    // Kid Mode passes an optional family id — nothing to subscribe to without one.
    if (!familyId) return

    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      markDataChanged()
      // debounce a burst of changes into a single refresh
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        refreshedAt.current[window.location.pathname] = Date.now()
        router.refresh()
      }, 400)
    }

    let channel = supabase.channel(`family-sync:${familyId}`)

    // Per-child activity. Skipped for a fresh family with no children yet.
    if (ids) {
      const filter = `child_id=in.(${ids})`
      channel = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'completions', filter }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'star_ledger', filter }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions', filter }, refresh)
    }

    // Family setup: adding/renaming/removing kids, tasks, rewards and events.
    // These carry family_id, so they filter directly — and they're the ones that
    // used to go unnoticed until an app restart.
    const famFilter = `family_id=eq.${familyId}`
    for (const table of ['children', 'tasks', 'rewards', 'family_events']) {
      channel = channel.on(
        'postgres_changes', { event: '*', schema: 'public', table, filter: famFilter }, refresh)
    }

    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [router, familyId, ids])

  // Arriving at a route whose cached render predates the last change — refetch it.
  useEffect(() => {
    const changed = lastDataChange()
    if (changed && changed > (refreshedAt.current[pathname] || 0)) {
      refreshedAt.current[pathname] = Date.now()
      router.refresh()
    }
  }, [pathname, router])

  return null
}
