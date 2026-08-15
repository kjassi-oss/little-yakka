import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendToFamily } from '@/lib/pushServer'
import { PREF_COLUMN_FOR, type NotifyKind } from '@/lib/notifyPrefs'

// Fire a push to every subscribed device in the CALLER'S family.
// Session-authenticated: the family is derived server-side, so a client can
// only ever notify its own family.
//
// Callers pass `kind` so the family's notification preferences can be applied
// HERE rather than at each call site — one choke point for all four callers
// (chores, rewards, and both in kid mode), and a client can't opt itself back
// in by omitting the check.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: guardian } = await supabase
    .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
  if (!guardian) return NextResponse.json({ error: 'No family' }, { status: 400 })

  let title = 'Little Yakka', body = '', kind: NotifyKind | null = null
  try {
    const json = await request.json()
    title = String(json.title || title).slice(0, 80)
    body = String(json.body || '').slice(0, 160)
    if (json.kind === 'task_done' || json.kind === 'reward_redeemed') kind = json.kind
  } catch {}

  // Preference gate. Only an explicit `false` suppresses the push: a missing
  // column (migration not run yet), a read error or an untagged caller all
  // mean "not switched off", so this can never silently swallow a notification.
  if (kind) {
    const column = PREF_COLUMN_FOR[kind]
    const { data: family, error } = await supabase
      .from('families').select(column).eq('id', guardian.family_id).single()
    if (!error && (family as Record<string, unknown> | null)?.[column] === false) {
      return NextResponse.json({ ok: true, skipped: kind })
    }
  }

  try {
    await sendToFamily(guardian.family_id, { title, body })
  } catch {
    // push not configured (no VAPID key / no subscribers) — never break the app for this
  }
  return NextResponse.json({ ok: true })
}
