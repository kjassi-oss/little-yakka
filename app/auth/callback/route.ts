import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth', request.url))
  }

  // Use a NextResponse.next() as a cookie jar during the exchange,
  // then copy its cookies onto the final redirect response.
  const cookieJar = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieJar.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('OAuth exchange error:', error.message)
    return NextResponse.redirect(new URL('/login?error=oauth', request.url))
  }

  // Determine where to send the user
  let destination = '/dashboard'
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: guardian } = await supabase
      .from('guardians').select('id').eq('auth_user_id', user.id).single()
    if (!guardian) destination = '/setup'
  }

  // Build the final redirect and copy auth cookies onto it
  const response = NextResponse.redirect(new URL(destination, request.url))
  cookieJar.cookies.getAll().forEach(c => {
    response.cookies.set(c.name, c.value, {
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite as 'lax' | 'strict' | 'none' | undefined,
      maxAge: c.maxAge,
      path: c.path,
    })
  })

  return response
}
