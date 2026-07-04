import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendToFamily } from '@/lib/pushServer'

// Fire a push to every subscribed device in the CALLER'S family.
// Session-authenticated: the family is derived server-side, so a client can
// only ever notify its own family.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: guardian } = await supabase
    .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
  if (!guardian) return NextResponse.json({ error: 'No family' }, { status: 400 })

  let title = 'Little Yakka', body = ''
  try {
    const json = await request.json()
    title = String(json.title || title).slice(0, 80)
    body = String(json.body || '').slice(0, 160)
  } catch {}

  try {
    await sendToFamily(guardian.family_id, { title, body })
  } catch {
    // push not configured (no VAPID key / no subscribers) — never break the app for this
  }
  return NextResponse.json({ ok: true })
}
