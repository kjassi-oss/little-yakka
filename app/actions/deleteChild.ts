'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) throw new Error('Child deletion is not configured (missing service role key).')
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
}

/**
 * Remove one child and everything that hangs off them.
 *
 * Settings used to run a bare `children.delete()` from the browser and ignore
 * the result. Child rows are referenced by completions/star_ledger/redemptions/
 * praises/spin_results/task_assignments, and those FKs don't all cascade — so
 * for any child with actual history the delete came back as a constraint
 * violation, was swallowed, and the child stayed in the database looking like a
 * caching bug. This mirrors the cascade order already proven in deleteAccount.
 *
 * The caller is checked against the session (must be a guardian of this child's
 * family) before the service-role key touches anything.
 */
export async function deleteChild(childId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  try {
    const admin = getAdmin()

    const { data: guardian } = await admin
      .from('guardians').select('family_id').eq('auth_user_id', user.id).maybeSingle()
    if (!guardian?.family_id) return { error: 'No family found for this account.' }

    const { data: child } = await admin
      .from('children').select('id, family_id').eq('id', childId).maybeSingle()
    if (!child) return {}                                   // already gone — nothing to do
    if (child.family_id !== guardian.family_id) return { error: 'That child belongs to another family.' }

    // Photos first: storage is keyed off family/child, so losing the row before
    // the files would strand them permanently (see purgeFamilyPhotos).
    const dir = `${guardian.family_id}/${childId}`
    const { data: photos } = await admin.storage.from('kid-avatars').list(dir)
    const photoPaths = (photos || []).filter(f => f.id !== null).map(f => `${dir}/${f.name}`)
    if (photoPaths.length) await admin.storage.from('kid-avatars').remove(photoPaths)

    // Dependants before the child itself — order matters, these FKs don't cascade.
    for (const table of ['spin_results', 'praises', 'redemptions', 'star_ledger', 'completions', 'task_assignments']) {
      const { error } = await admin.from(table).delete().eq('child_id', childId)
      // A table that doesn't exist in this project isn't fatal; a real failure is.
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        return { error: `Couldn't clear ${table}: ${error.message}` }
      }
    }

    // Calendar events list children in a uuid[] — drop the id from any that
    // reference this child so the event survives without a dangling avatar.
    // (best-effort: the column is optional, so a missing-column error is fine)
    const { data: events } = await admin
      .from('family_events').select('id, child_ids')
      .eq('family_id', guardian.family_id).contains('child_ids', [childId])
    for (const ev of events || []) {
      const remaining = ((ev.child_ids as string[]) || []).filter(id => id !== childId)
      await admin.from('family_events').update({ child_ids: remaining.length ? remaining : null }).eq('id', ev.id)
    }

    const { error } = await admin.from('children').delete().eq('id', childId)
    if (error) return { error: error.message }
    return {}
  } catch (e: any) {
    return { error: e.message || 'Unknown error' }
  }
}
