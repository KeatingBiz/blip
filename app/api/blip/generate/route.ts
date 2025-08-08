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
  const { data, error } = await supabase

