import { createBrowserClient } from '@supabase/ssr'

// Bypass navigator.locks for auth calls. WKWebView / headless browsers can
// leave the sb-*-auth-token web lock held forever, which deadlocks every
// getUser/getSession call and strands pages on the loading logo. The app runs
// in a single webview (no multi-tab refresh races), and Supabase tolerates
// concurrent refreshes (reuse-detection grace window), so skipping the lock
// is safe and removes that hang class entirely.
const noLock = async <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { lock: noLock } }
  )
}
