import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPER_REDIRECTS: Record<string, string> = {
  '/users': '/super/users',
  '/stores': '/super/stores',
  '/plans': '/super/plans',
  '/categories': '/super/categories',
  '/super-ai': '/super/super-ai',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const target = SUPER_REDIRECTS[pathname];
  if (target) {
    return NextResponse.redirect(new URL(target, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/users', '/stores', '/plans', '/categories', '/super-ai'],
};
