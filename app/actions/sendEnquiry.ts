'use server'

import { createClient } from '@/lib/supabase/server'

const SUPPORT_INBOX = process.env.CONTACT_TO_EMAIL || 'contact@littleyakka.com'
// Resend lets you send from onboarding@resend.dev without verifying a domain,
// but only to the address that owns the Resend account. That's exactly our case
// (we're emailing ourselves), so the free tier needs no DNS setup at all. Set
// CONTACT_FROM_EMAIL once littleyakka.com is verified there.
const SUPPORT_FROM = process.env.CONTACT_FROM_EMAIL || 'Little Yakka <onboarding@resend.dev>'

export type EnquiryResult = { ok: true; emailed: boolean } | { ok: false; error: string }

/**
 * File a support enquiry from Settings.
 *
 * The message is always written to `support_enquiries` first — that's the
 * durable copy, readable in the Supabase table editor — and only then do we try
 * to email it on. A missing/blocked email provider therefore loses nothing.
 */
export async function sendEnquiry(input: { topic: string; message: string; replyTo: string }): Promise<EnquiryResult> {
  const message = input.message?.trim()
  if (!message) return { ok: false, error: 'Please write a message first.' }
  if (message.length > 4000) return { ok: false, error: 'That message is too long — please keep it under 4000 characters.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in again and retry.' }

  const { data: guardian } = await supabase
    .from('guardians').select('id, family_id, name').eq('auth_user_id', user.id).maybeSingle()

  const replyTo = (input.replyTo?.trim() || user.email || '').slice(0, 200)
  const topic = (input.topic || 'General').slice(0, 60)

  // RLS-scoped insert (see supabase_migration.sql) — the session's own family.
  const { error } = await supabase.from('support_enquiries').insert({
    family_id: guardian?.family_id ?? null,
    guardian_id: guardian?.id ?? null,
    email: replyTo,
    topic,
    message,
  })

  const emailed = await notifySupport({ topic, message, replyTo, from: guardian?.name || 'A parent' })

  // Two independent ways for this to land. Either one is a success; only if
  // BOTH fail does the parent need to do something, and then they get a plain
  // instruction rather than a database error.
  if (error && !emailed) {
    console.error('[contact] enquiry not stored or emailed:', error.message)
    return { ok: false, error: 'We couldn’t send that just now — please email us at contact@littleyakka.com and we’ll pick it up.' }
  }
  if (error) console.error('[contact] enquiry emailed but not stored:', error.message)
  return { ok: true, emailed }
}

async function notifySupport(e: { topic: string; message: string; replyTo: string; from: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: SUPPORT_FROM,
        to: [SUPPORT_INBOX],
        reply_to: e.replyTo || undefined,
        subject: `Little Yakka enquiry — ${e.topic}`,
        text: `From: ${e.from} <${e.replyTo || 'no email given'}>\nTopic: ${e.topic}\n\n${e.message}`,
      }),
    })
    return res.ok
  } catch {
    // Never fail the user's submission over a mail provider — the row is saved.
    return false
  }
}
