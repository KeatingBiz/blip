import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildBlipScript, deriveWrittenSummary, ttsMp3 } from '../../../../lib/openai';
import { todayKeyTZ } from '../../../../lib/dates';
import { tzBucket, bucketAnchorTz, type Bucket, allBuckets } from '../../../../lib/tzbuckets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET || 'blip';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const b = url.searchParams.get('bucket') as Bucket | null;

    if (!b) {
      return new NextResponse(
        JSON.stringify({ error: `Missing ?bucket=…  Allowed: ${allBuckets().join(', ')}` }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
    if (!allBuckets().includes(b)) {
      return new NextResponse(
        JSON.stringify({ error: `Invalid bucket. Allowed: ${allBuckets().join(', ')}` }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const anchorTz = bucketAnchorTz(b);
    const ymd = todayKeyTZ(anchorTz);
    const cohortKey = `free:${b}:${ymd}`;

    // Already exists?
    const { data: existing, error: selErr } = await supabase
      .from('blips')
      .select('id,audio_url,script,summary,cohort_key')
      .eq('cohort_key', cohortKey)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) {
      return NextResponse.json({ ok: true, cohortKey, audioUrl: existing.audio_url, cached: true });
    }

    // Generate
    const script = await buildBlipScript({ topics: ['top','markets','world'] });
    const summary = await deriveWrittenSummary(script);
    const audioBuf = await ttsMp3(script, 'verse');

    // Upload with bucket in path
    const objectPath = `cohorts/${b}/${ymd}/free.mp3`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, audioBuf, {
      contentType: 'audio/mpeg', upsert: true,
    });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const audioUrl = pub?.publicUrl;

    // Save row
    const { error: insErr } = await supabase.from('blips').insert({
      cohort_key: cohortKey,
      date: ymd,
      audio_url: audioUrl,
      script,
      summary,
    });
    if (insErr) throw insErr;

    return NextResponse.json({ ok: true, cohortKey, audioUrl, cached: false });
  } catch (err: any) {
    console.error('CRON_PREP_ERROR', err?.message, err?.stack);
    return new NextResponse(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
