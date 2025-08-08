import { NextRequest } from 'next/server';
import { webSearchSummary } from '@/lib/openai';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const max = Number(searchParams.get('max') || 140);

  if (!q) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 });
  }

  try {
    // webSearchSummary expects { query: string }
    const result = await webSearchSummary({ query: q });

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


