// app/api/auth/ephemeral/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json({ error: 'Missing OPENAI_API_KEY' }, 500);

    const model = process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17';
    const voice = process.env.REALTIME_VOICE || 'verse';

    // Call OpenAI REST directly to create a short-lived Realtime session
    const resp = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ['audio', 'text'],
        instructions:
          'You are a concise, friendly assistant. Keep answers short (1–2 sentences) unless asked.',
        // You can add: 'audio_format': 'pcm16' if you want raw PCM. WebRTC flow doesn’t need it.
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return json({ error: data?.error?.message || 'Failed to create session', raw: data }, resp.status);
    }

    const token: string | undefined = data?.client_secret?.value;
    if (!token) {
      return json({ error: 'No client_secret returned from OpenAI', raw: data }, 500);
    }

    const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;

    // Return both 'token' and 'client_secret' for compatibility with either client shape
    return json({
      ok: true,
      mode: 'realtime',
      token,
      client_secret: token,
      url,
      model,
      voice,
    });
  } catch (err: any) {
    console.error('ephemeral error', err);
    return json({ error: err?.message || 'Failed to create session' }, 500);
  }
}

export async function POST(_req: NextRequest) {
  return GET();
}
