// app/api/cron/prep-cohorts/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildBlipScript, deriveWrittenSummary, ttsMp3 } from '@/lib/openai';

export const runtime = 'nodejs'; // use Node (not Edge) so Buffer & supabase-js work

// ---- Supabase admin client ----
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = process.env.SUPABASE_BUCKET || 'blip';

// ---- Types / Regions ----
type RegionBucket =
  | 'us_atlantic' | 'us_east' | 'us_central' | 'us_mountain' | 'us_arizona'
  | 'us_pacific' | 'us_alaska' | 'us_aleutian' | 'us_hawaii'
  | 'europe' | 'apac';

const REGION_TZ: Record<RegionBucket, string> = {
  us_atlantic: 'America/Halifax',
  us_east: 'America/New_York',
  us_central: 'America/Chicago',
  us_mountain: 'America/Denver',
  us_arizona: 'America/Phoenix',
  us_pacific: 'America/Los_Angeles',
  us_alaska: 'America/Anchorage',
  us_aleutian: 'America/Adak',
  us_hawaii: 'Pacific/Honolulu',
  europe: 'Europe/London',
  apac: 'Asia/Singapore',
};

// ---- Helpers ----
function ymdInTZ(tz: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find(p => p.type === 'year')?.value || '1970';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';

  return `${year}-${month}-${day}`;
}

function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function objectExists(prefix: string, name: string) {
  const { data } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
    search: name,
  });
  return (data || []).some(f => f.name === name);
}

async function safeRemove(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths); // ignore not-found
}

// ---- Route ----
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get('bucket') || '').trim().toLowerCase();
    const force = searchParams.get('force') === '1';

    if (!raw) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing ?bucket=' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Treat unknown values as string; timezone fallback covers us.
    const bucket = raw as RegionBucket;
    const tz = REGION_TZ[bucket] || process.env.BLIP_TZ || 'America/Chicago';

    const ymd = ymdInTZ(tz);
    const dir = `cohorts/${bucket}/${ymd}`;
    const audioName = 'free.mp3';
    const jsonName = 'free.json';
    const audioPath = `${dir}/${audioName}`;
    const jsonPath = `${dir}/${jsonName}`;

    // If we already prewarmed today’s asset (and not forcing), return it.
    if (!force) {
      const hasAudio = await objectExists(dir, audioName);
      if (hasAudio) {
        const hasJson = await objectExists(dir, jsonName);
        return new Response(
          JSON.stringify({
            ok: true,
            cached: true,
            region: bucket,
            tz,
            ymd,
            audioUrl: publicUrl(audioPath),
            textUrl: hasJson ? publicUrl(jsonPath) : null,
          }),
          { headers: { 'content-type': 'application/json' } }
        );
      }
    }

    // Generate fresh (NOTE: no `topics` prop — BuildBlipOpts is { tz?, region? }).
    const { script } = await buildBlipScript({ tz, region: bucket });
    const { summary } = await deriveWrittenSummary(script);

    // TTS uploads to tmp/* and returns { url, path }
    const { url: tmpUrl, path: tmpPath } = await ttsMp3(
      script,
      process.env.TTS_VOICE || 'verse'
    );

    // Move audio to canonical cohort path
    await safeRemove([audioPath]); // clear any prior file
    let moved = false;
    const storage: any = supabase.storage.from(BUCKET);
    const moveRes = await storage.move(tmpPath, audioPath);
    if (!moveRes?.error) {
      moved = true;
    } else {
      // Fallback: copy then remove tmp
      const copyRes = await storage.copy(tmpPath, audioPath);
      if (!copyRes?.error) {
        await safeRemove([tmpPath]);
        moved = true;
      }
    }

    // Upload summary JSON (as bytes to satisfy types)
    const jsonBody = JSON.stringify(
      { script, summary, meta: { tz, region: bucket, date: ymd } },
      null,
      2
    );
    await supabase.storage.from(BUCKET).upload(
      jsonPath,
      Buffer.from(jsonBody, 'utf-8'),
      {
        contentType: 'application/json',
        cacheControl: '3600',
        upsert: true,
      }
    );

    return new Response(
      JSON.stringify({
        ok: true,
        cached: false,
        region: bucket,
        tz,
        ymd,
        audioUrl: moved ? publicUrl(audioPath) : tmpUrl, // fallback to tmp if move failed
        textUrl: publicUrl(jsonPath),
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[cron/prep-cohorts] error', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Unexpected error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

