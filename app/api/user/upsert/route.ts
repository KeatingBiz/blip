import { supabaseAdmin } from '@/lib/supabaseAdmin';
export const runtime = 'edge';

export async function POST(req: Request) {
  const { user_id, email, plan } = await req.json();
  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: user_id, email, plan }, { onConflict: 'id' });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
}
