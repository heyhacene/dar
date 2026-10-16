import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CURRENT_BUILD = {
  version: '1.2.0',
  releaseName: 'Keo Family : Nouveau nom, Logo Le Foyer, Alertes & Calendrier',
  timestamp: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json(CURRENT_BUILD, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    },
  });
}
