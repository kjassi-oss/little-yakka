import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/LandingPage'

export const metadata: Metadata = {
  title: 'Little Yakka — Chores, stars & rewards for families',
  description:
    'Little Yakka helps parents set tasks, track stars, and hand out rewards while kids build habits that stick. Free on the App Store.',
}

// Root of www.littleyakka.com — also the URL the native iOS shell loads on launch.
// Logged-in requests (nearly every app open) redirect straight to the dashboard,
// so the app never renders the marketing page. Logged-out requests render the
// LandingPage, which bounces native users to /login and shows marketing to web.
export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return <LandingPage />
}
