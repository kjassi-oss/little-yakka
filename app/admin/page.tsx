import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import AdminUserList from './AdminUserList'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'kjassi@gmail.com').toLowerCase()

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 max-w-sm text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="font-black text-gray-800 text-lg mb-1">{title}</h1>
        <p className="text-sm text-gray-500">{body}</p>
      </div>
    </div>
  )
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return <Notice title="Not authorised" body="This page is restricted to the app administrator." />
  }

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) {
    return <Notice title="Admin not configured" body="Add your Supabase service_role key as SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy." />
  }

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })

  const [{ data: authData }, { data: guardians }, { data: families }, { data: children }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('guardians').select('id, name, email, family_id, auth_user_id'),
    admin.from('families').select('id, name'),
    admin.from('children').select('id, name, avatar, avatar_url, family_id'),
  ])

  const authUsers = authData?.users || []
  const familyName: Record<string, string> = {}
  ;(families || []).forEach(f => { familyName[f.id] = f.name })
  const guardianByAuth: Record<string, any> = {}
  ;(guardians || []).forEach(g => { if (g.auth_user_id) guardianByAuth[g.auth_user_id] = g })
  const kidsByFamily: Record<string, any[]> = {}
  ;(children || []).forEach(c => { (kidsByFamily[c.family_id] ||= []).push(c) })

  const rows = authUsers.map(u => {
    const g = guardianByAuth[u.id]
    const famId = g?.family_id || null
    return {
      authUserId: u.id,
      email: u.email || '—',
      name: g?.name || (u.user_metadata as any)?.full_name || '—',
      family: famId ? (familyName[famId] || '—') : '— (no family yet)',
      familyId: famId,
      kids: famId ? (kidsByFamily[famId] || []) : [],
      created: u.created_at ? new Date(u.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
      lastSignIn: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
      isAdmin: (u.email || '').toLowerCase() === ADMIN_EMAIL,
    }
  })

  const totalKids = (children || []).length

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl text-gray-800 mb-1" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          Little Yakka — Admin
        </h1>
        <p className="text-sm text-gray-400 mb-4">Signed in as {user.email}</p>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Registered users', value: authUsers.length },
            { label: 'Families', value: (families || []).length },
            { label: 'Children', value: totalKids },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-black text-gray-800">{s.value}</p>
              <p className="text-[11px] text-gray-400 font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <AdminUserList rows={rows} />
      </div>
    </div>
  )
}
