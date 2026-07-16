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

// ── Circled picker set ─────────────────────────────────────────────────────
// The 10 curated avatars offered when creating/editing a child: 5 girls then
// 5 boys, each pre-composited onto a coloured circle as c{kid}-t{tone}.svg
// (generated from the kid{i} set). Stored in children.avatar_url so every
// existing render site (img-based) picks them up with no changes.
export const PICKER_KIDS = [1, 2, 3, 5, 7, 4, 6, 8, 12, 14] // girls row, then boys row
export const PICKER_DEFAULT_TONES: Record<number, number> = {
  1: 2, 2: 4, 3: 0, 5: 2, 7: 1,   // girls
  4: 1, 6: 5, 8: 2, 12: 4, 14: 3, // boys
}

export function circledAvatarPath(kid: number, tone: number): string {
  return `/avatars/c${kid}-t${tone}.svg`
}

export function isCircledAvatar(v: string | null | undefined): boolean {
  return !!v && v.startsWith('/avatars/c')
}

export function parseCircledAvatar(v: string | null | undefined): { kid: number; tone: number } | null {
  const m = /^\/avatars\/c(\d+)-t(\d)\.svg$/.exec(v || '')
  return m ? { kid: Number(m[1]), tone: Number(m[2]) } : null
}
