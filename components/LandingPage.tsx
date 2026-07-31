'use client'

// Public marketing landing shown at "/" to WEB visitors only.
//
// The native iOS shell loads https://www.littleyakka.com ("/") on launch, so we
// must never show marketing inside the app. Two guards make that safe:
//   1. app/page.tsx (server) redirects any LOGGED-IN request straight to
//      /dashboard — that's almost every app open, and it never reaches here.
//   2. For logged-OUT requests this component renders. It shows a neutral splash
//      first, then on mount: native → bounce to /login (no marketing flash);
//      web browser → reveal the marketing page.
// Failure mode is safe: if native detection ever missed, a native user would see
// marketing with a working "Sign in" link, not a broken screen.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isNative } from '@/lib/nativeAuth'

const APP_STORE_URL = 'https://apps.apple.com/app/id6787948287'

export default function LandingPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isNative()) { router.replace('/login'); return }
    setReady(true)
  }, [router])

  // Splash — the only thing the native app can ever momentarily show before it
  // bounces to /login. Kept deliberately plain (no marketing).
  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <img src="/logo.png" alt="Little Yakka" className="w-40 h-auto animate-pulse" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white text-gray-800">
      {/* Hero — pure white so the logo's white matte blends seamlessly */}
      <section className="px-5 pt-14 pb-16 text-center bg-white">
        <div className="mx-auto max-w-xl">
          <img src="/logo.png" alt="Little Yakka" className="w-44 h-auto mx-auto mb-6" />

          <h1
            className="text-4xl sm:text-5xl font-black leading-tight text-gray-900"
            style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}
          >
            Chores, sorted. Habits, built.
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Little Yakka helps parents set tasks, track stars, and hand out rewards &mdash;
            while the whole family builds routines that actually stick.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <AppStoreBadge />
            <a href="/login" className="text-sm font-semibold text-gray-500 underline underline-offset-2">
              Already set up? Sign in
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-3xl grid gap-4 sm:grid-cols-2">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-3xl border border-gray-100 shadow-sm p-5 bg-white">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                style={{ backgroundColor: f.tint }}
              >
                {f.emoji}
              </div>
              <h2 className="font-black text-lg text-gray-900">{f.title}</h2>
              <p className="mt-1 text-[15px] text-gray-600 leading-relaxed">{f.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="px-5 pb-14">
        <div className="mx-auto max-w-3xl rounded-3xl px-6 py-8 text-center"
          style={{ background: 'linear-gradient(135deg, #0768C3 0%, #62449B 100%)' }}>
          <p className="text-white text-lg font-bold leading-snug">
            One parent account manages every child.
          </p>
          <p className="text-white/80 text-sm mt-1">
            No child sign-ins. No ads. No third-party trackers. Ever.
          </p>
          <div className="mt-5 flex justify-center">
            <AppStoreBadge />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 border-t border-gray-100">
        <div className="mx-auto max-w-3xl flex flex-col items-center gap-3 text-center">
          <nav className="flex items-center gap-5 text-sm font-semibold text-gray-500">
            <a href="/privacy" className="hover:text-gray-800">Privacy</a>
            <a href="/support" className="hover:text-gray-800">Support</a>
            <a href="mailto:contact@littleyakka.com" className="hover:text-gray-800">Contact</a>
          </nav>
          <p className="text-xs text-gray-400">&copy; 2026 Kiran Jassi &middot; Little Yakka</p>
        </div>
      </footer>
    </main>
  )
}

const FEATURES = [
  { emoji: '⭐', title: 'Stars & rewards', tint: '#FEF3C7',
    blurb: 'Set tasks, give them star values, and let kids spend earned stars on rewards you choose.' },
  { emoji: '🎡', title: 'Bonus Wheel', tint: '#EDE9FE',
    blurb: 'A weekly spin that pays out based on how much got done — more effort, bigger prizes.' },
  { emoji: '🏆', title: 'Streaks & trophies', tint: '#DCFCE7',
    blurb: 'Daily streaks and twelve unlockable trophies keep motivation high all week.' },
  { emoji: '👨‍👩‍👧‍👦', title: 'Built for families', tint: '#DBEAFE',
    blurb: 'One parent dashboard, a colourful zone for each child, and a co-parent invite to share the load.' },
]

// Placeholder badge styled to resemble Apple's. For full brand compliance, swap
// this for Apple's official "Download on the App Store" artwork:
// https://developer.apple.com/app-store/marketing/guidelines/
function AppStoreBadge() {
  return (
    <a
      href={APP_STORE_URL}
      className="inline-flex items-center gap-2.5 bg-black text-white rounded-xl px-5 py-2.5 active:scale-95 transition"
      aria-label="Download Little Yakka on the App Store"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
        <path d="M17.05 12.04c-.03-2.85 2.33-4.22 2.44-4.29-1.33-1.95-3.4-2.21-4.13-2.24-1.76-.18-3.43 1.03-4.32 1.03-.89 0-2.26-1.01-3.72-.98-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.94 1.37 2.06 2.9 3.53 2.85 1.42-.06 1.95-.91 3.66-.91 1.71 0 2.19.91 3.69.88 1.53-.03 2.49-1.39 3.42-2.77 1.08-1.59 1.52-3.13 1.55-3.21-.03-.01-2.97-1.14-3-4.53zM14.28 3.78c.78-.95 1.31-2.27 1.16-3.58-1.13.05-2.49.75-3.3 1.7-.72.84-1.36 2.18-1.19 3.47 1.26.1 2.55-.64 3.33-1.59z" />
      </svg>
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] font-medium">Download on the</span>
        <span className="text-lg font-semibold -mt-0.5">App Store</span>
      </span>
    </a>
  )
}
