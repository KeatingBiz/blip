import { supabaseAdmin } from '@/lib/supabaseAdmin';
export const runtime = 'edge';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('preferences')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  return new Response(JSON.stringify({ preferences: data || null }), {
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request) {
  const { user_id, location, topics, tickers, delivery_hour, timezone } = await req.json();
  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 });
  }
  const up = { user_id, location, topics, tickers, delivery_hour, timezone };
  const { error } = await supabaseAdmin
    .from('preferences')
    .upsert(up, { onConflict: 'user_id' });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
}
