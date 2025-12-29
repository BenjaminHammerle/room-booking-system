import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 🔐 Zugriffsschutz
  const protectedRoutes =
      request.nextUrl.pathname.startsWith('/rooms') ||
      request.nextUrl.pathname.startsWith('/admin')

  if (!session && protectedRoutes) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/rooms/:path*', '/admin/:path*'],
}
