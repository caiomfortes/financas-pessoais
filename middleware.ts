import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('auth')?.value;
  const isAuth = token === process.env.APP_PASSWORD;
  const isLoginPage = req.nextUrl.pathname === '/login';
  const isApi = req.nextUrl.pathname.startsWith('/api/');
  const isPublicApi = req.nextUrl.pathname === '/api/auth';

  if (isPublicApi) return NextResponse.next();

  if (isApi && !isAuth) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!isAuth && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest).*)'],
};
