'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Live co-parent sync: when tasks/stars/redemptions change in the database,
// re-fetch the current server-rendered page so both parents see updates instantly.
// Requires Realtime to be enabled on these tables in Supabase (see supabase_migration.sql).
export default function RealtimeRefresh() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      // debounce a burst of changes into a single refresh
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 400)
    }

    const channel = supabase
      .channel('family-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'star_ledger' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions' }, refresh)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
