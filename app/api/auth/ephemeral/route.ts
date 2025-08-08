// app/api/auth/ephemeral/route.ts
import { createRealtimeSession } from '@/lib/openai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      voice = 'verse',
      // you can send these from the client if you want,
      // but we don't have to pass them to the helper unless you updated its typing
      instructions,
      model,
    } = body || {};

    // NOTE: createRealtimeSession expects a single options object.
    // Passing two positional args causes the TS error you saw.
    const session = await createRealtimeSession({
      voice,
      instructions,
      model,
    });

    return new Response(
      JSON.stringify({
        client_secret: session.client_secret?.value,
        expires_at: session.client_secret?.expires_at,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || 'Failed to create realtime session' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
