'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Consistent profile chip shown top-right on every dashboard page → opens Settings.
export default function ProfileButton({ className = '' }: { className?: string }) {
  const [initial, setInitial] = useState('')

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('guardians').select('name').eq('auth_user_id', user.id).single()
      const n = (data?.name || '').trim()
      setInitial(n ? n.charAt(0).toUpperCase() : '')
    })()
  }, [])

  return (
    <Link href="/dashboard/settings" aria-label="Profile and settings"
      className={`w-9 h-9 rounded-full bg-white flex items-center justify-center font-black shadow-md active:scale-95 transition shrink-0 ${className}`}
      style={{ color: 'var(--theme-from)' }}>
      {initial || '👤'}
    </Link>
  )
}
