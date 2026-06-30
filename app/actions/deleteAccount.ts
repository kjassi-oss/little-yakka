'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) throw new Error('Account deletion is not configured (missing service role key).')
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
}

// Lets a signed-in guardian permanently delete their own account and, if they
// are the last guardian, the entire family's data. Mirrors the admin cascade
// but derives the user from the session, so no admin privileges are required.
export async function deleteMyAccount(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const authUserId = user.id

  try {
    const admin = getAdmin()

    const { data: guardian } = await admin
      .from('guardians').select('id, family_id').eq('auth_user_id', authUserId).maybeSingle()
    const familyId = guardian?.family_id

    if (familyId) {
      const { count: otherGuardians } = await admin
        .from('guardians').select('id', { count: 'exact', head: true })
        .eq('family_id', familyId).neq('auth_user_id', authUserId)

      if ((otherGuardians ?? 0) === 0) {
        // Last guardian — remove the whole family tree
        const { data: childRows } = await admin.from('children').select('id').eq('family_id', familyId)
        const childIds = (childRows || []).map(c => c.id)
        const { data: taskRows } = await admin.from('tasks').select('id').eq('family_id', familyId)
        const taskIds = (taskRows || []).map(t => t.id)

        if (childIds.length) {
          await Promise.all([
            admin.from('spin_results').delete().in('child_id', childIds),
            admin.from('praises').delete().in('child_id', childIds),
            admin.from('redemptions').delete().in('child_id', childIds),
            admin.from('star_ledger').delete().in('child_id', childIds),
            admin.from('completions').delete().in('child_id', childIds),
          ])
        }
        if (taskIds.length) {
          await Promise.all([
            admin.from('task_benchmark_photos').delete().in('task_id', taskIds),
            admin.from('task_assignments').delete().in('task_id', taskIds),
          ])
        }

        await Promise.all([
          admin.from('tasks').delete().eq('family_id', familyId),
          admin.from('rewards').delete().eq('family_id', familyId),
          admin.from('guardian_invitations').delete().eq('family_id', familyId),
          childIds.length ? admin.from('children').delete().in('id', childIds) : Promise.resolve(),
        ])

        const { data: allGuardians } = await admin
          .from('guardians').select('auth_user_id').eq('family_id', familyId)
        const otherAuthIds = (allGuardians || [])
          .map(g => g.auth_user_id)
          .filter(id => id && id !== authUserId)

        await admin.from('guardians').delete().eq('family_id', familyId)
        await admin.from('families').delete().eq('id', familyId)

        if (childIds.length) {
          const { data: avatarList } = await admin.storage.from('kid-avatars').list(familyId)
          if (avatarList?.length) {
            await admin.storage.from('kid-avatars').remove(avatarList.map(f => `${familyId}/${f.name}`))
          }
        }

        for (const coAuthId of otherAuthIds) {
          if (coAuthId) await admin.auth.admin.deleteUser(coAuthId)
        }
      } else {
        // Other guardians remain — just remove this guardian record
        await admin.from('guardians').delete().eq('auth_user_id', authUserId)
      }
    }

    const { error } = await admin.auth.admin.deleteUser(authUserId)
    if (error) return { error: error.message }
    return {}
  } catch (e: any) {
    return { error: e.message || 'Unknown error' }
  }
}
