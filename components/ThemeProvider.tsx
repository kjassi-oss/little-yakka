'use client'

import { useEffect } from 'react'

// Each theme drives the WHOLE app via CSS variables:
//   --theme-from / --theme-to  → solid accent colours (text, borders, fills)
//   --theme-gradient           → the big header/button gradient (can be multi-stop)
//
// Colours are sampled from the Little Yakka logo (logo.png):
//   teal #06A8B2 · purple #62449B · yellow #F8B211 · raspberry #EC4160
//   green #5FAD43 · blue #0768C3 · orange #F69112 · navy #0E2473
// Princess Pink is the one deliberate off-palette keeper.
export const THEMES = {
  rainbow:  { name: 'Rainbow',        emoji: '🌈', from: '#EC4160', to: '#62449B', gradient: 'linear-gradient(135deg, #EC4160, #F69112, #F8B211, #5FAD43, #0768C3, #62449B)' },
  candy:    { name: 'Candy Pop',      emoji: '🍭', from: '#EC4160', to: '#F69112', gradient: 'linear-gradient(135deg, #EC4160, #F69112)' },
  princess: { name: 'Princess Pink',  emoji: '👑', from: '#E84393', to: '#FF7AC6', gradient: 'linear-gradient(135deg, #F368E0, #FF8FB1)' },
  rockstar: { name: 'Rock Star Blue', emoji: '🎸', from: '#0E2473', to: '#0768C3', gradient: 'linear-gradient(135deg, #0E2473, #0768C3)' },
  sunshine: { name: 'Sunshine',       emoji: '☀️', from: '#F69112', to: '#F8B211', gradient: 'linear-gradient(135deg, #F69112, #F8B211)' },
  mint:     { name: 'Minty Fresh',    emoji: '🍃', from: '#5FAD43', to: '#06A8B2', gradient: 'linear-gradient(135deg, #5FAD43, #06A8B2)' },
  galaxy:   { name: 'Galaxy',         emoji: '🌌', from: '#62449B', to: '#EC4160', gradient: 'linear-gradient(135deg, #62449B, #EC4160)' },
  ocean:    { name: 'Ocean',          emoji: '🌊', from: '#0768C3', to: '#06A8B2', gradient: 'linear-gradient(135deg, #0768C3, #06A8B2)' },
} as const

export type ThemeKey = keyof typeof THEMES
const DEFAULT_THEME: ThemeKey = 'ocean'

// "#0EA5E9" → "14, 165, 233"
function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

function applyTheme(key: string) {
  const theme = THEMES[key as ThemeKey] ?? THEMES[DEFAULT_THEME]
  const root = document.documentElement
  root.setAttribute('data-theme', key)
  root.style.setProperty('--theme-from', theme.from)
  root.style.setProperty('--theme-to', theme.to)
  root.style.setProperty('--theme-gradient', theme.gradient)
  // Channels only, so tints can be built with rgba(var(--theme-from-rgb), 0.08).
  // `var(--theme-from)14` LOOKS like it appends an alpha byte but is invalid CSS —
  // it silently computes to transparent, which is why themed tints never showed.
  root.style.setProperty('--theme-from-rgb', hexToRgb(theme.from))
  root.style.setProperty('--theme-to-rgb', hexToRgb(theme.to))
}

export function getStoredTheme(): ThemeKey {
  try { return (localStorage.getItem('ly-theme') as ThemeKey) || DEFAULT_THEME } catch { return DEFAULT_THEME }
}

export function setStoredTheme(key: ThemeKey) {
  try { localStorage.setItem('ly-theme', key) } catch {}
  applyTheme(key)
  window.dispatchEvent(new CustomEvent('ly-theme-change', { detail: key }))
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(getStoredTheme())
    const handler = (e: Event) => applyTheme((e as CustomEvent).detail)
    window.addEventListener('ly-theme-change', handler)
    return () => window.removeEventListener('ly-theme-change', handler)
  }, [])

  return <>{children}</>
}
