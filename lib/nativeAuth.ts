// Native (Capacitor/iOS) Google sign-in via the in-app browser + deep link.
// Google refuses OAuth inside an embedded webview, so on native we open the OAuth
// page in an in-app Safari view and catch the redirect back via a custom URL scheme
// (see components/NativeAuth.tsx). On the web this file's helpers are never used.
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import type { SupabaseClient } from '@supabase/supabase-js'

// Custom URL scheme registered in ios/App/App/Info.plist and allow-listed in Supabase.
export const NATIVE_REDIRECT = 'com.littleyakka.app://auth-callback'

export const isNative = () => Capacitor.isNativePlatform()

// Start Google OAuth on native: get the provider URL (no auto-redirect) and open it
// in the in-app browser. The appUrlOpen listener finishes the exchange.
export async function nativeGoogleSignIn(supabase: SupabaseClient): Promise<{ error?: string }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
  })
  if (error) return { error: error.message }
  if (!data?.url) return { error: 'Could not start Google sign-in' }
  await Browser.open({ url: data.url })
  return {}
}
