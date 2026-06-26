import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'
import OnboardingTour from '@/components/OnboardingTour'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardians')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!guardian) redirect('/setup')

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
      <BottomNav />
      <OnboardingTour />
    </div>
  )
}
