import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function KidModePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardians').select('family_id').eq('auth_user_id', user.id).single()
  if (!guardian) redirect('/setup')

  const { data: children } = await supabase
    .from('children').select('*').eq('family_id', guardian.family_id).order('name')

  const childIds = children?.map(c => c.id) || []
  const { data: starData } = await supabase
    .from('star_ledger').select('child_id, delta')
    .in('child_id', childIds.length ? childIds : ['none'])

  const balances: Record<string, number> = {}
  starData?.forEach(row => {
    balances[row.child_id] = (balances[row.child_id] || 0) + row.delta
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-400 to-orange-300 flex flex-col items-center justify-center p-6">
      <Link href="/dashboard" className="absolute top-8 left-6 bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-white/30 transition">
        ← Exit
      </Link>

      <div className="text-center mb-10">
        <div className="text-6xl mb-3 animate-bounce">⭐</div>
        <h1 className="text-3xl font-bold text-white drop-shadow-lg">Who's doing tasks?</h1>
        <p className="text-white/80 mt-1 text-lg">Tap your picture!</p>
      </div>

      <div className={`grid gap-4 w-full max-w-xs ${(children?.length || 0) === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {children?.map(child => (
          <Link
            key={child.id}
            href={`/kid-mode/${child.id}`}
            className="flex flex-col items-center gap-3 p-6 rounded-3xl shadow-xl active:scale-95 transition-transform"
            style={{ backgroundColor: child.colour }}
          >
            <span className="text-7xl drop-shadow">{child.avatar}</span>
            <div className="text-center">
              <p className="font-bold text-white text-xl drop-shadow">{child.name}</p>
              <p className="text-white/90 text-sm font-semibold mt-0.5">⭐ {balances[child.id] || 0} Stars</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
