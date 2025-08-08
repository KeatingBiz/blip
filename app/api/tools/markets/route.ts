import { marketsNow } from '@/lib/openai';
export const runtime = 'edge';

let cache: { value: any; expires: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return new Response(JSON.stringify(cache.value), {
      headers: { 'content-type': 'application/json' },
    });
  }
  const data = await marketsNow();
  cache = { value: data, expires: now + 60_000 }; // 60s cache
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  });
}
