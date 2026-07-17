// Child photos live in the PRIVATE `kid-avatars` storage bucket. children.avatar_url
// stores the (public-form) object URL, but a private bucket won't serve it directly —
// so we swap it for a short-lived SIGNED URL at every point child data is fetched,
// BEFORE it reaches any render site. Signing is gated by the bucket's family-scoped
// storage RLS, so a caller can only sign their own family's photos.
//
// Bundled avatars (/avatars/*.webp) and anything not in the bucket pass through
// untouched. This means no render site and no stored data has to change.

import type { SupabaseClient } from '@supabase/supabase-js'

export const AVATAR_BUCKET = 'kid-avatars'
const SIGNED_TTL = 60 * 60 // 1 hour — SSR/loadData re-sign on each load

// Extract the in-bucket object path from a stored avatar_url, or null if the
// value isn't a kid-avatars object (bundled path, external URL, empty).
export function avatarStoragePath(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/${AVATAR_BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return url.slice(i + marker.length).split('?')[0]
}

// Normalise an avatar_url back to its stable, canonical public-form URL before
// writing it to the DB — so a temporary SIGNED url (which the fetch helpers put
// into client state) never gets persisted. Bundled paths / external urls / null
// pass through unchanged. `supabaseUrl` = NEXT_PUBLIC_SUPABASE_URL.
export function canonicalAvatarUrl(url: string | null | undefined, supabaseUrl: string): string | null {
  if (!url) return url ?? null
  const path = avatarStoragePath(url)
  if (!path) return url // bundled (/avatars/...) or external — leave as-is
  return `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`
}

// Replace each object's avatar_url with a fresh signed URL, in place. Accepts
// any objects that carry an `avatar_url` field — including the nested `children`
// object returned by completions/redemptions joins (pass those through too).
// One batched round-trip regardless of how many photos are present.
export async function signAvatarUrls(
  supabase: SupabaseClient,
  objs: Array<{ avatar_url?: string | null } | null | undefined>,
): Promise<void> {
  const targets: { obj: { avatar_url?: string | null }; path: string }[] = []
  for (const o of objs) {
    if (!o || !o.avatar_url) continue
    const path = avatarStoragePath(o.avatar_url)
    if (path) targets.push({ obj: o, path })
  }
  if (!targets.length) return

  // Dedupe paths (same child can appear in many joined rows)
  const uniquePaths = [...new Set(targets.map(t => t.path))]
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(uniquePaths, SIGNED_TTL)
  const byPath = new Map((data || []).map(d => [d.path, d.signedUrl]).filter(([, u]) => !!u) as [string, string][])
  for (const t of targets) {
    const signed = byPath.get(t.path)
    if (signed) t.obj.avatar_url = signed
  }
}
