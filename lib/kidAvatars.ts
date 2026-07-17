// ── Picker set ──────────────────────────────────────────────────────────────
// The 12 avatars offered when creating/editing a child: illustrated kid
// portraits, resized to 320px webp, 6 girls then 6 boys. Values are public
// paths stored in children.avatar_url so every render site (img-based) picks
// them up with no changes.
export const PICKER_AVATARS: string[] = [
  ...['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map(s => `/avatars/kid-${s}.webp`),
  ...['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map(s => `/avatars/kid-${s}.webp`),
]

// Any avatar shipped with the app (the /avatars/ set) — as opposed to an
// uploaded photo living in Supabase storage.
export function isBundledAvatar(v: string | null | undefined): boolean {
  return !!v && v.startsWith('/avatars/')
}
