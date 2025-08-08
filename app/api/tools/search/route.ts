import { NextRequest } from 'next/server';
import { webSearchSummary } from '@/lib/openai';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  // allow ?max= to override, default 140 chars
  const max = Number(searchParams.get('max')) || 140;

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 });
  }

  try {
    const result = await webSearchSummary(query); // <- single arg now

    // handle both shapes (string or { summary, ... })
    const summary =
      typeof result === 'string'
        ? result
        : (result as any).summary ?? JSON.stringify(result);

    const clipped =
      summary.length > max ? summary.slice(0, max - 1).trimEnd() + '…' : summary;

    return new Response(JSON.stringify({ summary: clipped, raw: result }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Search failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

