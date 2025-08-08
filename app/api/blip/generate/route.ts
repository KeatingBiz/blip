import { nanoid } from 'nanoid';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildBlipScript, deriveWrittenSummary, ttsMp3 } from '@/lib/openai';
import { saveAudioBuffer } from '@/lib/storage';

export const runtime = 'nodejs';

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { user_id, mode = 'auto' } = body || {};
  const ymd = todayKey();

  // Figure out plan + prefs
  let plan: 'free' | 'premium' = 'free';
  let prefs: any = null;

  if (user_id) {
    const prof = await supabaseAdmin.from('profiles').select('plan').eq('id', user_id).maybeSingle();
    if (!prof.error && prof.data?.plan) plan = prof.data.plan;
    const pref = await supabaseAdmin.from('preferences').select('*').eq('user_id', user_id).maybeSingle();
    if (!pref.error) prefs = pref.data;
  }

  const effectivePlan = mode === 'free' ? 'free' : plan;

  // Free cohort (reused for all free users per day)
  if (effectivePlan === 'free') {
    const cohortKey = `free:${ymd}`;
    const existing = await supabaseAdmin.from('blips').select('*').eq('cohort_key', cohortKey).maybeSingle();
    if (!existing.error && existing.data) {
      return new Response(
        JSON.stringify({
          audioUrl: existing.data.audio_url,
          script: existing.data.script,
          summary: existing.data.summary,
          cohort: cohortKey,
        }),
        { headers: { 'content-type': 'application/json' } }
      );
    }

    const topics = ['markets', 'top', 'world'];
    const script = await buildBlipScript({ topics, persona: 'neutral' });
    const summary = await deriveWrittenSummary(script);
    const mp3 = await ttsMp3(script, 'verse');
    const filename = `blip_free_${ymd}_${nanoid(6)}.mp3`;
    const audioUrl = await saveAudioBuffer(filename, mp3);

    await supabaseAdmin.from('blips').insert({
      date: ymd,
      cohort_key: cohortKey,
      script,
      summary,
      audio_url: audioUrl,
    });

    return new Response(JSON.stringify({ audioUrl, script, summary, cohort: cohortKey }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // Premium personalized
  const topics = (prefs?.topics && prefs.topics.length) ? prefs.topics : ['markets', 'us', 'world'];
  const tickers = prefs?.tickers || ['SPY', 'BTC-USD'];
  const location = prefs?.location || '';

  // Already generated today?
  if (user_id) {
    const existing = await supabaseAdmin
      .from('blips')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', ymd)
      .maybeSingle();

    if (!existing.error && existing.data) {
      return new Response(
        JSON.stringify({
          audioUrl: existing.data.audio_url,
          script: existing.data.script,
          summary: existing.data.summary,
        }),
        { headers: { 'content-type': 'application/json' } }
      );
    }
  }

  const script = await buildBlipScript({ topics, tickers, location, persona: 'neutral' });
  const summary = await deriveWrittenSummary(script);
  const mp3 = await ttsMp3(script, 'verse');
  const filename = `blip_user_${user_id || 'anon'}_${ymd}_${nanoid(6)}.mp3`;
  const audioUrl = await saveAudioBuffer(filename, mp3);

  await supabaseAdmin.from('blips').insert({
    date: ymd,
    user_id,
    script,
    summary,
    audio_url: audioUrl,
  });

  return new Response(JSON.stringify({ audioUrl, script, summary }), {
    headers: { 'content-type': 'application/json' },
  });
}
