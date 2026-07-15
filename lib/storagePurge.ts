import type { SupabaseClient } from '@supabase/supabase-js'

// Buckets that hold family-scoped photos. Both nest one level below the family:
//   kid-avatars     familyId/childId/avatar-<ts>.jpg
//   task-benchmarks familyId/taskId/photo_0.jpg
const PHOTO_BUCKETS = ['kid-avatars', 'task-benchmarks'] as const

// In a storage listing, folders come back with `id: null`; real files have an id.
const isFile = (entry: { id: string | null }) => entry.id !== null

/**
 * Delete every stored photo belonging to a family.
 *
 * The layout is nested, so `list(familyId)` returns the CHILD/TASK FOLDERS, not
 * files — and `remove()` silently no-ops when handed a folder path. That's why
 * account deletion never actually removed a photo: it listed one level, built
 * `familyId/childId` paths, called remove(), got no error, and left everything
 * in place. We have to walk down to the leaf files.
 *
 * Legacy `familyId/avatar.jpg` uploads (pre child-folder) are handled too.
 *
 * Throws on failure rather than swallowing — silent failure is the original bug.
 */
export async function purgeFamilyPhotos(admin: SupabaseClient, familyId: string): Promise<number> {
  let removed = 0

  for (const bucket of PHOTO_BUCKETS) {
    const paths: string[] = []

    const { data: top, error: topErr } = await admin.storage.from(bucket).list(familyId)
    if (topErr) throw new Error(`purge: listing ${bucket}/${familyId} failed — ${topErr.message}`)

    for (const entry of top || []) {
      if (isFile(entry)) {
        paths.push(`${familyId}/${entry.name}`)   // legacy flat layout
        continue
      }
      const prefix = `${familyId}/${entry.name}`
      const { data: files, error: subErr } = await admin.storage.from(bucket).list(prefix)
      if (subErr) throw new Error(`purge: listing ${bucket}/${prefix} failed — ${subErr.message}`)
      for (const f of files || []) {
        if (isFile(f)) paths.push(`${prefix}/${f.name}`)
      }
    }

    if (!paths.length) continue

    const { data: gone, error: rmErr } = await admin.storage.from(bucket).remove(paths)
    if (rmErr) throw new Error(`purge: removing ${paths.length} file(s) from ${bucket} failed — ${rmErr.message}`)
    removed += gone?.length ?? 0
  }

  return removed
}
