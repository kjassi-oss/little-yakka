import { NextResponse } from 'next/server'
import { getServiceClient, sendToSubs, type PushSub } from '@/lib/pushServer'
import { occursOn } from '@/lib/recurrence'
import { localNow, localDateStr, localTimeHHMM } from '@/lib/localDate'
import { DEFAULT_NOTIFY_PREFS, NOTIFY_PREF_COLUMNS, hhmm } from '@/lib/notifyPrefs'

// Daily reminder cron (see vercel.json). For each family that wants it, count
// today's still-pending task occurrences and nudge the parents.
//
// ── TIMING AND DAYLIGHT SAVING ──────────────────────────────────────────────
// Vercel cron expressions are always UTC and have no timezone option, so any
// fixed hour drifts by an hour when Australia changes clocks: the old
// "0 7 * * *" was 5pm in winter and 6pm in summer. Rather than encode local
// time in the schedule (and edit it twice a year, and get it wrong for every
// family outside Sydney), this route asks "is it their chosen time yet, where
// this family actually lives?" using the IANA timezone stored on the family.
// Intl carries the DST rules, so that stays correct forever, in any country.
//
// That per-family precision only pays off if the route is invoked hourly:
//   • Vercel free plan caps crons at once per day. Leave REMINDER_HOURLY unset
//     and schedule "0 21 * * *" (7am AEST / 8am AEDT): every family gets the
//     reminder on that single run, and their chosen time is stored but not yet
//     honoured.
//   • Invoked hourly — Vercel Pro's "0 * * * *", or a free external pinger
//     hitting this URL with the CRON_SECRET header — set REMINDER_HOURLY=1 and
//     each family's own reminder time is respected.
// Nothing else changes between the two modes; the dedupe below makes hourly
// invocation safe.
//
// Vercel automatically sends "Authorization: Bearer <CRON_SECRET>" when the
// CRON_SECRET env var is set.
const HOURLY = process.env.REMINDER_HOURLY === '1'

// When the preference columns don't exist yet we can't dedupe, so an hourly
// invocation would re-send every hour. In that fallback we only act on one
// UTC hour per day, which is provably at-most-once regardless of schedule.
// 21:00 UTC = 7am AEST / 8am AEDT, matching the shipped cron.
const FALLBACK_UTC_HOUR = 21

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

  // Preferences live on `families`. If the migration hasn't run the select
  // fails as a whole, and we fall back to the pre-preferences behaviour:
  // everyone gets a reminder, default timezone, no per-family time.
  const { data: famRows, error: prefsError } = await admin
    .from('families').select(`id, ${NOTIFY_PREF_COLUMNS}`).in('id', familyIds)
  const prefsAvailable = !prefsError
  const prefsById = new Map(
    (famRows || []).map(f => [(f as Record<string, any>).id as string, f as Record<string, any>])
  )

  if (!prefsAvailable && new Date().getUTCHours() !== FALLBACK_UTC_HOUR) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'awaiting migration; outside daily window' })
  }

  let sent = 0
  let skipped = 0
  const stamp: { id: string; on: string }[] = []

  for (const familyId of familyIds) {
    const prefs = prefsById.get(familyId)
    const tz = (prefsAvailable && prefs?.timezone) || DEFAULT_NOTIFY_PREFS.timezone
    const today = localDateStr(new Date(), tz)

    if (prefsAvailable) {
      if (prefs?.notify_daily_reminder === false) { skipped++; continue }
      // Already considered today — guards repeat invocations (hourly schedules,
      // Vercel retries, manual test pings).
      if (prefs?.last_reminder_on === today) { skipped++; continue }
      // Not their time yet. Only meaningful when invoked more than once a day;
      // under a single daily run this would permanently skip anyone whose
      // chosen time falls after the run, so it's gated on HOURLY.
      if (HOURLY && hhmm(localTimeHHMM(tz)) < hhmm(prefs?.daily_reminder_time)) { skipped++; continue }
    }

    const now = localNow(tz)
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

    // Stamp whether or not anything was sent, so each family is evaluated at
    // most once per local day. (A family with nothing pending at 7am doesn't
    // need re-checking every hour — pending only ever falls during the day.)
    if (prefsAvailable) stamp.push({ id: familyId, on: today })
  }

  if (stamp.length) {
    await Promise.all(stamp.map(f =>
      admin.from('families').update({ last_reminder_on: f.on }).eq('id', f.id)
    ))
  }

  return NextResponse.json({ ok: true, sent, skipped, mode: HOURLY ? 'hourly' : 'daily', prefsAvailable })
}
