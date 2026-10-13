import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const googleWebhookUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const clientData = await req.json();

  if (!googleWebhookUrl) {
    return NextResponse.json({
      success: true,
      mode: 'local',
      data: clientData,
      message: 'Mode stockage local actif.',
    });
  }

  try {
    const response = await fetch(googleWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync',
        data: clientData,
        timestamp: new Date().toISOString(),
      }),
    });

    const googleResult = await response.json();
    return NextResponse.json({
      success: true,
      mode: 'google_drive',
      data: googleResult.data || clientData,
    });
  } catch (error) {
    console.error('Erreur liaison Google Drive:', error);
    return NextResponse.json(
      { error: 'Erreur de synchronisation Google Drive', fallbackData: clientData },
      { status: 502 }
    );
  }
}
