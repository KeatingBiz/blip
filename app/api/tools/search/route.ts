import { webSearchSummary } from '@/lib/openai';
export const runtime = 'edge';

export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400 });
  }
  const data = await webSearchSummary(query, 140);
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  });
}
