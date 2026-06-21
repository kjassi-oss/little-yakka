import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardians')
    .select('name, family_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!guardian) redirect('/setup')

  const [{ data: family }, { data: children }, { data: starData }] = await Promise.all([
    supabase.from('families').select('name').eq('id', guardian.family_id).single(),
    supabase.from('children').select('*').eq('family_id', guardian.family_id).order('name'),
    supabase.from('star_ledger').select('child_id, delta'),
  ])

  const today = new Date().toISOString().split('T')[0]
  const childIds = children?.map(c => c.id) || []

  const { count: todayCompletions } = await supabase
    .from('completions')
    .select('*', { count: 'exact', head: true })
    .eq('date', today)
    .eq('status', 'approved')
    .in('child_id', childIds.length ? childIds : ['none'])

  const balances: Record<string, number> = {}
  starData?.forEach(row => {
    balances[row.child_id] = (balances[row.child_id] || 0) + row.delta
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-gradient-to-br from-purple-500 to-pink-500 pt-12 pb-10 px-4">
        <div className="max-w-sm mx-auto">
          <p className="text-purple-200 text-sm">Welcome back</p>
          <h1 className="text-2xl font-bold text-white">{guardian.name} 👋</h1>
          <p className="text-purple-200 text-sm">{family?.name}</p>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 -mt-5 space-y-4">
        {/* Today stat */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Today</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-2xl">✅</div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{todayCompletions || 0}</p>
              <p className="text-sm text-gray-500">tasks completed</p>
            </div>
          </div>
        </div>

        {/* Kid Mode button */}
        <Link
          href="/kid-mode"
          className="block bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl p-5 text-center shadow-lg active:scale-98 transition"
        >
          <div className="text-4xl mb-2">⭐</div>
          <p className="text-white font-bold text-lg">Enter Kid Mode</p>
          <p className="text-purple-200 text-sm mt-0.5">Let the kids check off their tasks</p>
        </Link>

        {/* Children */}
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Your Kids</h2>
          <div className="space-y-2">
            {children?.map(child => (
              <div key={child.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: child.colour + '33' }}
                >
                  {child.avatar}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{child.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-yellow-500">⭐ {balances[child.id] || 0}</p>
                  <p className="text-xs text-gray-400">stars</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manage tasks link */}
        <Link href="/dashboard/chores" className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl">📋</div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800">Manage Tasks</p>
            <p className="text-sm text-gray-400">Add and edit chores & routines</p>
          </div>
          <span className="text-gray-300 text-xl">›</span>
        </Link>
      </div>
    </div>
  )
}
