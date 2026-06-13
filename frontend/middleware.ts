import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Define protected dashboard and tool routes
  const isProtectedRoute = path.startsWith('/dashboard') || 
                          path.startsWith('/resume') || 
                          path.startsWith('/jobs') || 
                          path.startsWith('/mentor') || 
                          path.startsWith('/roadmap');
  
  // Define authentication pages
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/register');

  // Supabase creates local storage/cookie values starting with 'sb-' (e.g. sb-access-token)
  const cookies = request.cookies.getAll();
  const hasSupabaseSession = cookies.some(cookie => cookie.name.includes('sb-') || cookie.name.includes('supabase'));

  if (isProtectedRoute && !hasSupabaseSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Clear redirect loop parameters by only appending if coming from outside
    url.searchParams.set('redirected', 'true');
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && hasSupabaseSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Matcher configuration for Next.js middleware
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/resume/:path*',
    '/jobs/:path*',
    '/mentor/:path*',
    '/roadmap/:path*',
    '/login',
    '/register',
  ],
};
