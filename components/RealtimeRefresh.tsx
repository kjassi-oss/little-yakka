'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Live co-parent sync: when tasks/stars/redemptions change in the database,
// re-fetch the current server-rendered page so both parents see updates instantly.
// Requires Realtime to be enabled on these tables in Supabase (see supabase_migration.sql).
//
// Scoped to this family's children. Unfiltered, every open page in the app got a
// callback evaluated for EVERY family's writes, so server work grew as
// (writes x concurrent clients) — fine at 20 families, not at 1000. These tables
// have no family_id, so we filter on child_id instead.
export default function RealtimeRefresh({ familyId, childIds }: { familyId: string; childIds: string[] }) {
  const router = useRouter()
  // Primitive dep: the array identity changes every render, the string doesn't.
  const ids = childIds.join(',')

  useEffect(() => {
    // No children yet (fresh family) — nothing can change, so don't hold a connection.
    if (!ids) return

    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      // debounce a burst of changes into a single refresh
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 400)
    }

    const filter = `child_id=in.(${ids})`
    const channel = supabase
      .channel(`family-sync:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'star_ledger', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions', filter }, refresh)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [router, familyId, ids])

  return null
}
