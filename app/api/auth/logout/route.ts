import { NextResponse } from 'next/server';
import { clearAuthCookieHeader } from '@/lib/auth';

export async function POST() {
  const cookie = clearAuthCookieHeader();
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
