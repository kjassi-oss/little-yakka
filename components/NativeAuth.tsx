'use client'

// Listens for the OAuth deep link (com.littleyakka.app://auth-callback?code=...) that
// the in-app browser returns to after Google/Apple sign-in, then hands the code to the
// server /auth/callback route — the SAME path the web flow uses. That route exchanges
// the code and routes new users to /setup and returning users to /dashboard. Native only.
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

export default function NativeAuth() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle: { remove: () => void } | undefined
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url || !url.includes('auth-callback')) return
      const params = new URL(url).searchParams
      const code = params.get('code')
      const err = params.get('error_description') || params.get('error')
      try { await Browser.close() } catch {}
      if (code) {
        // Server callback exchanges the code (PKCE verifier is in the cookie set when
        // sign-in started) and redirects to /setup (new) or /dashboard (returning).
        window.location.href = `/auth/callback?code=${encodeURIComponent(code)}`
      } else if (err) {
        window.location.href = `/login?error=${encodeURIComponent(err)}`
      }
    }).then(h => { handle = h })
    return () => { handle?.remove() }
  }, [])
  return null
}
