'use server'

import { createClient } from '@/lib/supabase/server'

// Parent-PIN gate for leaving Kid Mode. The PIN is verified SERVER-side so it
// is never sent to the (child-facing) client. It's a soft barrier — the app is
// parent-managed and there are no child logins — but it stops a child in Kid
// Mode from wandering into the parent dashboard / Settings / Delete Account.

// True if this family has a parent PIN set (a non-empty 4-digit string).
export async function hasParentPin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('guardians').select('parent_pin').eq('auth_user_id', user.id).single()
  return !!(data?.parent_pin && String(data.parent_pin).length === 4)
}

// Verify a candidate PIN against the caller's stored PIN. Returns true if the
// family has no PIN set (nothing to gate) so callers fail open safely.
export async function verifyParentPin(pin: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('guardians').select('parent_pin').eq('auth_user_id', user.id).single()
  const stored = data?.parent_pin ? String(data.parent_pin) : ''
  if (!stored) return true // no PIN configured → not gated
  return pin === stored
}
