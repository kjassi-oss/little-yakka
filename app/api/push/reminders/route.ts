import { NextResponse } from 'next/server'
import { getServiceClient, sendToSubs, type PushSub } from '@/lib/pushServer'
import { occursOn } from '@/lib/recurrence'
import { localNow, localDateStr } from '@/lib/localDate'

// Daily reminder cron (see vercel.json). For each family with subscribers,
// count today's still-pending task occurrences and nudge the parents.
// Vercel automatically sends "Authorization: Bearer <CRON_SECRET>" when the
// CRON_SECRET env var is set.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let admin
  try { admin = getServiceClient() } catch { return NextResponse.json({ ok: false, reason: 'no service key' }) }

  const { data: subs } = await admin
    .from('push_subscriptions').select('family_id, endpoint, p256dh, auth, platform')
  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const familyIds = [...new Set(subs.map(s => s.family_id))]
  // Note: reminders use the default app timezone (Australia/Sydney)
  const now = localNow()
  const today = localDateStr(new Date())
  let sent = 0

  for (const familyId of familyIds) {
    const [{ data: tasks }, { data: children }] = await Promise.all([
      admin.from('tasks').select('*').eq('family_id', familyId),
      admin.from('children').select('id').eq('family_id', familyId),
    ])
    const childIds = (children || []).map(c => c.id)
    if (!childIds.length) continue

    const [{ data: assigns }, { data: comps }] = await Promise.all([
      admin.from('task_assignments').select('task_id, child_id').in('child_id', childIds),
      admin.from('completions').select('task_id, child_id').eq('date', today).in('child_id', childIds),
    ])
    const doneSet = new Set((comps || []).map(c => `${c.task_id}|${c.child_id}`))

    let pending = 0
    for (const t of (tasks || [])) {
      if ((t as any).up_for_grabs) continue
      if (!occursOn(t as any, now)) continue
      for (const a of (assigns || []).filter(a => a.task_id === t.id)) {
        if (!doneSet.has(`${a.task_id}|${a.child_id}`)) pending++
      }
    }

    if (pending > 0) {
      const famSubs = subs.filter(s => s.family_id === familyId) as PushSub[]
      await sendToSubs(famSubs, {
        title: '⭐ Little Yakka',
        body: `${pending} task${pending === 1 ? '' : 's'} still to finish today — you've got this!`,
      })
      sent += famSubs.length
    }
  }

  return NextResponse.json({ ok: true, sent })
}
