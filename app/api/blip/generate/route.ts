// app/api/blip/generate/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildBlipScript, deriveWrittenSummary, ttsMp3 } from '@/lib/openai';

// IMPORTANT: Node runtime (not Edge) so Buffer & supabase-js work as expected
export const runtime = 'nodejs';

// ---- Supabase admin client (server-side only) ----
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Use your configured bucket (default: 'blip')
const BUCKET = process.env.SUPABASE_BUCKET || 'blip';

// ---------------- Helpers ----------------
type RegionBucket =
  | 'us_atlantic' | 'us_east' | 'us_central' | 'us_mountain' | 'us_arizona'
  | 'us_pacific' | 'us_alaska' | 'us_aleutian' | 'us_hawaii'
  | 'europe' | 'apac';

// Conservative mapping from IANA TZ -> your region buckets
function mapIanaToBucket(tz: string): RegionBucket {
  const t = (tz || '').toLowerCase();

  // US named buckets
  if (t.includes('honolulu') || t.includes('hawaii')) return 'us_hawaii';
  if (t.includes('adak') || t.includes('aleutian')) return 'us_aleutian';
  if (t.includes('anchorage') || t.includes('alaska')) return 'us_alaska';
  if (t.includes('phoenix') || t.includes('arizona')) return 'us_arizona';
  if (t.includes('los_angeles') || t.includes('vancouver') || t.includes('pacific')) return 'us_pacific';
  if (t.includes('denver') || t.includes('boise') || t.includes('mountain')) return 'us_mountain';
  if (t.includes('chicago') || t.includes('winnipeg') || t.includes('mexico_city') || t.includes('central')) return 'us_central';
  if (t.includes('new_york') || t.includes('detroit') || t.includes('toronto') || t.includes('eastern')) return 'us_east';
  if (t.includes('halifax') || t.includes('puerto_rico') || t.includes('atlantic')) return 'us_atlantic';

  // Coarse global buckets
  if (t.startsWith('europe/') || t.startsWith('africa/')) return 'europe';
  if (
    t.startsWith('asia/') ||
    t.startsWith('australia/') ||
    t.startsWith('pacific/') ||
    t.startsWith('indian/')
  ) return 'apac';

  // Fallback to US central if unknown
  return 'us_central';
}

// yyy-mm-dd in a given IANA TZ (based on current date in that tz)
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
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
    search: name,
  });
  if (error) return false;
  return (data || []).some(f => f.name === name);
}

async function safeRemove(paths: string[]) {
  // Remove, ignoring "not found" errors
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

// ---------------- Route ----------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // Accept ?bucket=... (preferred if provided), else derive from IANA tz
    const qsBucket = (searchParams.get('bucket') || '').trim().toLowerCase() as RegionBucket | '';
    const qpTz = (searchParams.get('tz') || '').trim() || req.headers.get('x-iana-tz') || '';
    const fallbackTz = process.env.BLIP_TZ || 'America/Chicago';

    const tz = qpTz || fallbackTz;
    const bucket: RegionBucket = (qsBucket as RegionBucket) || mapIanaToBucket(tz);

    // Optional: allow forcing regeneration (?force=1) for QA
    const force = searchParams.get('force') === '1';

    // Compute today's path in that tz
    const ymd = ymdInTZ(tz);
    const dir = `cohorts/${bucket}/${ymd}`;
    const audioName = 'free.mp3';
    const jsonName = 'free.json';
    const audioPath = `${dir}/${audioName}`;
    const jsonPath = `${dir}/${jsonName}`;

    // If not forcing, try returning prewarmed cohort assets
    if (!force) {
      const hasAudio = await objectExists(dir, audioName);
      if (hasAudio) {
        // JSON is optional; return URL if present
        const hasJson = await objectExists(dir, jsonName);
        return new Response(JSON.stringify({
          ok: true,
          cached: true,
          region: bucket,
          tz,
          ymd,
          audioUrl: publicUrl(audioPath),
          textUrl: hasJson ? publicUrl(jsonPath) : null,
        }), { headers: { 'content-type': 'application/json' } });
      }
    }

    // On-demand generation (no 'topics' arg — matches BuildBlipOpts)
    const { script } = await buildBlipScript({ tz, region: bucket });
    const { summary } = await deriveWrittenSummary(script);
    const { url: tmpUrl, path: tmpPath } = await ttsMp3(script, process.env.TTS_VOICE || 'verse');

    // Move audio from tmp/* to canonical cohort path
    // 1) Ensure destination is clean
    await safeRemove([audioPath]);
    // 2) Move (if move fails on your SDK version, we fallback to copy+remove)
    let moved = false;
    // @ts-ignore - storage.move exists in supabase-js v2
    const moveRes = await (supabase.storage.from(BUCKET) as any).move(tmpPath, audioPath);
    if (!moveRes.error) {
      moved = true;
    } else {
      // Fallback: copy then remove tmp
      const copyRes = await supabase.storage.from(BUCKET).copy(tmpPath, audioPath);
      if (!copyRes.error) {
        await safeRemove([tmpPath]);
        moved = true;
      }
    }

    // Upload summary JSON (upsert so cron or re-run is fine)
    const jsonBody = JSON.stringify(
      { script, summary, meta: { tz, region: bucket, date: ymd } },
      null,
      2
    );
    await supabase.storage.from(BUCKET).upload(jsonPath, jsonBody, {
      contentType: 'application/json',
      cacheControl: '3600',
      upsert: true,
    });

    // Build final URLs
    const finalAudioUrl = publicUrl(audioPath);
    const finalJsonUrl = publicUrl(jsonPath);

    return new Response(JSON.stringify({
      ok: true,
      cached: false,
      region: bucket,
      tz,
      ymd,
      audioUrl: moved ? finalAudioUrl : tmpUrl, // fallback to tmp if move failed
      textUrl: finalJsonUrl,
    }), { headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    console.error('[blip/generate] error', err);
    return new Response(JSON.stringify({
      ok: false,
      error: err?.message || 'Unexpected error',
    }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

