'use client'

import { useEffect } from 'react'

export const THEMES = {
  purple: { name: '💜 Purple Dream', from: '#7C3AED', to: '#EC4899' },
  ocean:  { name: '🩵 Ocean Vibes',  from: '#0EA5E9', to: '#06B6D4' },
  forest: { name: '💚 Forest Chill', from: '#059669', to: '#34D399' },
  sunset: { name: '🧡 Sunset Glow',  from: '#EA580C', to: '#F59E0B' },
  galaxy: { name: '🌌 Galaxy Mode',  from: '#4F46E5', to: '#7C3AED' },
  rose:   { name: '🌹 Rose Gold',    from: '#E11D48', to: '#F97316' },
} as const

export type ThemeKey = keyof typeof THEMES

function applyTheme(key: string) {
  const theme = THEMES[key as ThemeKey] ?? THEMES.purple
  const root = document.documentElement
  root.setAttribute('data-theme', key)
  root.style.setProperty('--theme-from', theme.from)
  root.style.setProperty('--theme-to', theme.to)
}

export function getStoredTheme(): ThemeKey {
  try { return (localStorage.getItem('ly-theme') as ThemeKey) || 'purple' } catch { return 'purple' }
}

export function setStoredTheme(key: ThemeKey) {
  try { localStorage.setItem('ly-theme', key) } catch {}
  applyTheme(key)
  window.dispatchEvent(new CustomEvent('ly-theme-change', { detail: key }))
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = getStoredTheme()
    applyTheme(key)

    const handler = (e: Event) => applyTheme((e as CustomEvent).detail)
    window.addEventListener('ly-theme-change', handler)
    return () => window.removeEventListener('ly-theme-change', handler)
  }, [])

  return <>{children}</>
}
