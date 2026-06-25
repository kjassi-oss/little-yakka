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

    // Check if this user already has a guardian record
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: guardian } = await supabase
        .from('guardians').select('id').eq('auth_user_id', user.id).single()

      if (!guardian) {
        // New Google user — auto-create family + guardian
        const displayName = user.user_metadata?.full_name
          || user.user_metadata?.name
          || user.email?.split('@')[0]
          || 'Parent'
        const { data: family } = await supabase
          .from('families').insert({ name: `${displayName.split(' ')[0]}'s Family` }).select('id').single()
        if (family) {
          await supabase.from('guardians').insert({
            auth_user_id: user.id,
            family_id: family.id,
            name: displayName,
          })
        }
      }
    }

    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.redirect(new URL('/login?error=oauth', request.url))
}
