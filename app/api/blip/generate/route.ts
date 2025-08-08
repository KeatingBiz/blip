import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildBlipScript, deriveWrittenSummary, ttsMp3 } from '../../../../lib/openai';
import { todayKeyTZ } from '../../../../lib/dates';
import { tzBucket, bucketAnchorTz, type Bucket } from '../../../../lib/tzbuckets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET || 'blip';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const clientTz = (body?.tz as string | undefined) || '';
    const b: Bucket = tzBucket(clientTz);
    const anchorTz = bucketAnchorTz(b);
    const ymd = todayKeyTZ(anchorTz);
    const cohortKey = `free:${b}:${ymd}`;

    // Try today's regional cohort
    let { data: row, error: selErr } = await supabase
      .from('blips')
      .select('id,audio_url,script,summary,cohort_key,date')
      .eq('cohort_key', cohortKey)
      .maybeSingle();
    if (selErr) throw selErr;

    // If missing (cron didn’t hit yet), generate on-demand for this region
    if (!row) {
      const script = await buildBlipScript({ topics: ['top','markets','world'] });
      const summary = await deriveWrittenSummary(script);
      const audioBuf = await ttsMp3(script, 'verse');
      const objectPath = `cohorts/${b}/${ymd}/free.mp3`;

      const { error: upErr } = await supabase
        .storage.from(BUCKET)
        .upload(objectPath, audioBuf, { contentType: 'audio/mpeg', upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      const audioUrl = pub?.publicUrl;

      const { data: ins, error: insErr } = await supabase.from('blips')
        .insert({ cohort_key: cohortKey, date: ymd, audio_url: audioUrl, script, summary })
        .select()
        .single();
      if (insErr) throw insErr;
      row = ins;
    }

    return NextResponse.json({
      audioUrl: row!.audio_url,
      script: row!.script,
      summary: row!.summary,
      cohort: row!.cohort_key,
    });
  } catch (err: any) {
    console.error('BLIP_GENERATE_ERROR', err?.message, err?.stack);
    return new NextResponse(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
