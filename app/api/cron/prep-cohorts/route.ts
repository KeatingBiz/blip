import { buildBlipScript, deriveWrittenSummary, ttsMp3 } from '@/lib/openai';
import { saveAudioBuffer } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';

export async function POST() {
  const ymd = new Date().toISOString().slice(0, 10);
  const cohortKey = `free:${ymd}`;

  const existing = await supabaseAdmin
    .from('blips')
    .select('id')
    .eq('cohort_key', cohortKey)
    .maybeSingle();

  if (!existing.error && existing.data) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const topics = ['markets', 'top', 'world'];
  const script = await buildBlipScript({ topics });
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

  return new Response(JSON.stringify({ ok: true, cohortKey, audioUrl }), {
    headers: { 'content-type': 'application/json' },
  });
}
