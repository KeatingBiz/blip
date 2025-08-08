// app/api/blip/generate/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildBlipScript, deriveWrittenSummary, ttsMp3 } from '@/lib/openai';

export const runtime = 'nodejs'; // Node runtime so Buffer & supabase-js work

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

// Conservative IANA -> bucket mapping
function mapIanaToBucket(tz: string): RegionBucket {
  const t = (tz || '').toLowerCase();
  if (t.includes('honolulu') || t.includes('hawaii')) return 'us_hawaii';
  if (t.includes('adak') || t.includes('aleutian')) return 'us_aleutian';
  if (t.includes('anchorage') || t.includes('alaska')) return 'us_alaska';
  if (t.includes('phoenix') || t.includes('arizona')) return 'us_arizona';
  if (t.includes('los_angeles') || t.includes('vancouver') || t.includes('pacific')) return 'us_pacific';
  if (t.includes('denver') || t.includes('boise') || t.includes('mountain')) return 'us_mountain';
  if (t.includes('chicago') || t.includes('winnipeg') || t.includes('mexico_city') || t.includes('central')) return 'us_central';
  if (t.includes('new_york') || t.includes('detroit') || t.includes('toronto') || t.includes('eastern')) return 'us_east';
  if (t.includes('halifax') || t.includes('puerto_rico') || t.includes('atlantic')) return 'us_atlantic';
  if (t.startsWith('europe/') || t.startsWith('africa/')) return 'europe';
  if (t.startsWith('asia/') || t.startsWith('australia/') || t.startsWith('pacific/') || t.startsWith('indian/')) return 'apac';
  return 'us_central';
}

// yyyy-mm-dd for local day in tz
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
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths); // ignore not-found
}

type Inputs = {
  bucket?: string | null;
  tz?: string | null;
  force?: boolean;
};

async function handle(req: NextRequest, fromBody?: Partial<Inputs>) {
  const url = new URL(req.url);
  const search = url.searchParams;

  // Accept from querystring or JSON body
  const qsBucket = (search.get('bucket') || '').trim().toLowerCase();
  const qsTz = (search.get('tz') || '').trim();
  const qsForce = search.get('force') === '1';

  const bodyBucket = (fromBody?.bucket || '').trim().toLowerCase();
  const bodyTz = (fromBody?.tz || '').trim();
  const bodyForce = !!fromBody?.force;

  const rawBucket = bodyBucket || qsBucket;
  const tz = bodyTz || qsTz || req.headers.get('x-iana-tz') || process.env.BLIP_TZ || 'America/Chicago';
  const bucket = (rawBucket as RegionBucket) || mapIanaToBucket(tz);
  const force = bodyForce || qsForce;

  const ymd = ymdInTZ(tz);
  const dir = `cohorts/${bucket}/${ymd}`;
  const audioName = 'free.mp3';
  const jsonName = 'free.json';
  const audioPath = `${dir}/${audioName}`;
  const jsonPath = `${dir}/${jsonName}`;

  if (!force) {
    const hasAudio = await objectExists(dir, audioName);
    if (hasAudio) {
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

  // Generate new (no `topics`; BuildBlipOpts is { tz?, region? })
  const { script } = await buildBlipScript({ tz, region: bucket });
  const { summary } = await deriveWrittenSummary(script);
  const { url: tmpUrl, path: tmpPath } = await ttsMp3(script, process.env.TTS_VOICE || 'verse');

  // Move audio to canonical cohort path
  await safeRemove([audioPath]); // clear any prior file
  let moved = false;
  const storage: any = supabase.storage.from(BUCKET);
  const moveRes = await storage.move(tmpPath, audioPath);
  if (!moveRes?.error) {
    moved = true;
  } else {
    const copyRes = await storage.copy(tmpPath, audioPath);
    if (!copyRes?.error) {
      await safeRemove([tmpPath]);
      moved = true;
    }
  }

  // Upload summary JSON
  const jsonBody = JSON.stringify(
    { script, summary, meta: { tz, region: bucket, date: ymd } },
    null,
    2
  );
  await supabase.storage.from(BUCKET).upload(
    jsonPath,
    Buffer.from(jsonBody, 'utf-8'),
    { contentType: 'application/json', cacheControl: '3600', upsert: true }
  );

  return new Response(JSON.stringify({
    ok: true,
    cached: false,
    region: bucket,
    tz,
    ymd,
    audioUrl: moved ? publicUrl(audioPath) : tmpUrl, // fallback to tmp if move failed
    textUrl: publicUrl(jsonPath),
  }), { headers: { 'content-type': 'application/json' } });
}

// ---- Method handlers ----
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  let body: Partial<Inputs> = {};
  try {
    body = await req.json();
  } catch { /* ignore empty body */ }
  return handle(req, body);
}

// Useful for preflight / non-GET fetches
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Allow': 'GET, POST, OPTIONS, HEAD',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'content-type',
    },
  });
}

export async function HEAD(req: NextRequest) {
  const res = await handle(req);
  return new Response(null, { status: res.status, headers: res.headers });
}
