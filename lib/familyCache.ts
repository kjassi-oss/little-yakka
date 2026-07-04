import type { SupabaseClient } from '@supabase/supabase-js'

// Fast family lookup for client pages. getSession() reads local storage (no
// network), and the guardian→family mapping never changes in practice, so we
// cache it per user. Saves two sequential round trips on every page load.
export async function getCachedFamily(supabase: SupabaseClient): Promise<{ userId: string; familyId: string } | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return null

  try {
    const cached = JSON.parse(localStorage.getItem('ly-fam') || 'null')
    if (cached?.userId === userId && cached.familyId) return { userId, familyId: cached.familyId }
  } catch {}

  const { data: g } = await supabase
    .from('guardians').select('family_id').eq('auth_user_id', userId).maybeSingle()
  if (!g?.family_id) return null
  try { localStorage.setItem('ly-fam', JSON.stringify({ userId, familyId: g.family_id })) } catch {}
  return { userId, familyId: g.family_id }
}
