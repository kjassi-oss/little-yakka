import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'
import SideNav from '@/components/SideNav'
import RealtimeRefresh from '@/components/RealtimeRefresh'
import OnboardingTour from '@/components/OnboardingTour'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardians')
    .select('id, family_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!guardian) redirect('/setup')

  // Realtime is scoped to this family's children — see RealtimeRefresh.
  const { data: kids } = await supabase
    .from('children')
    .select('id')
    .eq('family_id', guardian.family_id)

  return (
    <div className="min-h-screen bg-gray-50">
      <SideNav />
      <div className="lg:pl-56">
        {children}
      </div>
      <BottomNav />
      <RealtimeRefresh familyId={guardian.family_id} childIds={(kids || []).map(k => k.id)} />
      <OnboardingTour />
    </div>
  )
}
