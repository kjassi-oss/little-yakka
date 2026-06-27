import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL('/login?error=oauth', request.url))

    // New users (no guardian record yet) go through the setup wizard;
    // returning users land on the dashboard. The dashboard layout also
    // redirects guardian-less users to /setup as a safety net.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: guardian } = await supabase
        .from('guardians').select('id').eq('auth_user_id', user.id).single()
      if (!guardian) return NextResponse.redirect(new URL('/setup', request.url))
    }

    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.redirect(new URL('/login?error=oauth', request.url))
}
