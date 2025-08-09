// app/api/auth/ephemeral/route.ts
import { NextRequest } from 'next/server';
import { createRealtimeSession } from '@/lib/openai';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // You can later compute 'mode' = 'realtime' | 'standard' here
    const voice = process.env.REALTIME_VOICE || 'verse';
    const model = process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17';

    // Create short-lived client secret for the browser to connect directly
    const session = await createRealtimeSession({
      voice,
      model,
      instructions:
        'You are a concise, friendly assistant. Keep answers short (1–2 sentences) unless asked.',
      modalities: ['audio', 'text'],
    });

    // session.client_secret?.value is what the client uses as a bearer token
    const token = (session as any)?.client_secret?.value;
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing client_secret from session.' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;

    // For now always return 'realtime'. Later you can return 'standard' to fall back
    return new Response(
      JSON.stringify({ ok: true, mode: 'realtime', token, url, model, voice }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('ephemeral error', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to create session' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

// Optional POST mirror (some clients use POST)
export async function POST(req: NextRequest) {
  return GET();
}

