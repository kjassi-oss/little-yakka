'use client'

// Listens for the OAuth deep link (com.littleyakka.app://auth-callback?code=...) that
// the in-app browser returns to after Google sign-in, exchanges the code for a Supabase
// session (which sets the SSR cookies), then navigates into the app. Native only.
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { createClient } from '@/lib/supabase/client'

export default function NativeAuth() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle: { remove: () => void } | undefined
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url || !url.includes('auth-callback')) return
      try {
        const code = new URL(url).searchParams.get('code')
        if (code) await createClient().auth.exchangeCodeForSession(code)
      } catch {
        // ignore — user stays on the login page and can retry
      }
      try { await Browser.close() } catch {}
      window.location.href = '/dashboard'
    }).then(h => { handle = h })
    return () => { handle?.remove() }
  }, [])
  return null
}
