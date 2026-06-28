'use server'

import { cookies } from 'next/headers'

export async function setTimezone(tz: string) {
  const cookieStore = await cookies()
  cookieStore.set('tz', tz, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,  // 1 year
    sameSite: 'lax',
    httpOnly: false,  // client needs to read it too
  })
}
