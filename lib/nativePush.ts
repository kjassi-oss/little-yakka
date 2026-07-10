// Client helper for native (Capacitor/iOS) push registration via APNs.
// On the web this is never used — the browser PWA keeps using pushManager/web-push.
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

const TOKEN_KEY = 'ly_apns_token'

// iOS only for now: Android native push needs Firebase/FCM, which v1 ships
// without (Android falls through to the web path, which reports unsupported).
export const isNativePush = () => Capacitor.getPlatform() === 'ios'

export async function nativePermissionState(): Promise<'on' | 'off' | 'denied'> {
  const perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'denied') return 'denied'
  return perm.receive === 'granted' ? 'on' : 'off'
}

// Prompt (if needed), register with APNs, and return the device token.
export async function registerNativePush(): Promise<{ token: string } | { error: string }> {
  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') return { error: 'denied' }

  return new Promise((resolve) => {
    const cleanup = () => { regH.then(h => h.remove()); errH.then(h => h.remove()) }
    const regH = PushNotifications.addListener('registration', (t) => {
      try { localStorage.setItem(TOKEN_KEY, t.value) } catch {}
      cleanup(); resolve({ token: t.value })
    })
    const errH = PushNotifications.addListener('registrationError', (e: unknown) => {
      cleanup(); resolve({ error: 'registration_error' })
    })
    PushNotifications.register()
  })
}

export function cachedNativeToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function clearNativeToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
}
