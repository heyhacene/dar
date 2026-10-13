import { NextRequest, NextResponse } from 'next/server';
import { createAuthCookieHeader, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password || !verifyPassword(password)) {
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }

    const cookie = createAuthCookieHeader();
    const response = NextResponse.json({ success: true, message: 'Authentification réussie' });
    response.cookies.set(cookie.name, cookie.value, cookie.options);

    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
