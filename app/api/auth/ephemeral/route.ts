import { createRealtimeSession } from '@/lib/openai';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { voice = 'verse', modalities = ['audio', 'text'] } = body || {};
  const session = await createRealtimeSession(voice, modalities as any);
  return new Response(
    JSON.stringify({
      client_secret: session.client_secret?.value,
      id: session.id,
      expires_at: session.expires_at,
    }),
    { headers: { 'content-type': 'application/json' } }
  );
}
