// Server-side web push helpers. Uses the service-role key to read the family's
// push subscriptions (bypasses RLS — server only, never import client-side).
import webpush from 'web-push'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { VAPID_PUBLIC_KEY } from './pushKeys'

let configured = false
function configure(): boolean {
  if (configured) return true
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:kjassi@gmail.com', VAPID_PUBLIC_KEY, priv)
  configured = true
  return true
}

export function getServiceClient() {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) throw new Error('No service role key configured')
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
}

export interface PushSub { endpoint: string; p256dh: string; auth: string }

// Send to a list of subscriptions; prune ones the browser has revoked (410/404).
export async function sendToSubs(subs: PushSub[], payload: { title: string; body: string; url?: string }) {
  if (!configure() || !subs.length) return
  const admin = getServiceClient()
  const body = JSON.stringify(payload)
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body
      )
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
  }))
}

export async function sendToFamily(familyId: string, payload: { title: string; body: string; url?: string }) {
  const admin = getServiceClient()
  const { data: subs } = await admin
    .from('push_subscriptions').select('endpoint, p256dh, auth').eq('family_id', familyId)
  await sendToSubs((subs || []) as PushSub[], payload)
}
