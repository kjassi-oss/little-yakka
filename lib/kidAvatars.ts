// Bundled cartoon kid avatars — "Custom Avatar" by Ashley Seo (CC BY 4.0),
// generated via DiceBear "big-smile" and stored in /public/avatars as
// kid{i}-t{tone}.svg. Tones run 0 (lightest) → 5 (deepest); each kid ships in
// all six so a long-press can switch skin tone.
export const AVATAR_KIDS = 15
export const TONE_COUNT = 6

// Default tone per kid (index 0 = kid1) — mixed so the picker looks diverse
export const DEFAULT_TONES = [2, 4, 0, 1, 2, 5, 1, 1, 5, 0, 2, 4, 3, 3, 1]

export function kidAvatarPath(kid: number, tone: number): string {
  return `/avatars/kid${kid}-t${tone}.svg`
}

export function isKidAvatar(v: string | null | undefined): boolean {
  return !!v && v.startsWith('/avatars/kid')
}

export function parseKidAvatar(v: string): { kid: number; tone: number } | null {
  const m = /^\/avatars\/kid(\d+)-t(\d)\.svg$/.exec(v)
  return m ? { kid: Number(m[1]), tone: Number(m[2]) } : null
}

// ── Picker set ──────────────────────────────────────────────────────────────
// The 12 avatars offered when creating/editing a child: the user's own
// "Kid Avatar" artwork (AI-illustrated portraits, resized to 320px webp),
// 6 girls then 6 boys. Values are public paths stored in children.avatar_url
// so every existing render site (img-based) picks them up with no changes.
// (The older c{kid}-t{tone}.svg DiceBear composites stay on disk so children
// saved with them keep rendering.)
export const PICKER_AVATARS: string[] = [
  ...['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map(s => `/avatars/kid-${s}.webp`),
  ...['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map(s => `/avatars/kid-${s}.webp`),
]

// Any avatar shipped with the app (old SVG composites or the new webp set) —
// as opposed to an uploaded photo living in Supabase storage.
export function isBundledAvatar(v: string | null | undefined): boolean {
  return !!v && v.startsWith('/avatars/')
}
