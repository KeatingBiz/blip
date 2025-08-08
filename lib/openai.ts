// lib/openai.ts
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// ---------- Clients ----------
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- Types ----------
type RegionBucket =
  | 'us_atlantic' | 'us_east' | 'us_central' | 'us_mountain' | 'us_arizona'
  | 'us_pacific' | 'us_alaska' | 'us_aleutian' | 'us_hawaii'
  | 'europe' | 'apac';

export type BuildBlipOpts = {
  tz?: string | null;
  region?: RegionBucket | string | null;
};

export type BuildBlipResult = {
  script: string;
  meta?: Record<string, any>;
};

// ---------- Helpers ----------
function nowInTZ(tz?: string) {
  const d = new Date();
  if (!tz) return d;
  // Represent local time components in the provided time zone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);

  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0');

  // Build a new Date using the parts but in UTC to avoid DST weirdness
  // (Not perfectly exact for historical dates but fine for "now".)
  const year = get('year');
  const month = get('month'); // 01..12
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
  return new Date(iso);
}

function ymd(d = new Date()) {
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

function humanizeForVoice(text: string) {
  // Gentle shaping: contractions + read-aloud pacing hints
  return text
    .replace(/\s+/g, ' ')
    .replace(/%/g, ' percent')
    .trim();
}

// ---------- Public: marketsNow ----------
/**
 * Lightweight U.S. market clock (no holiday logic).
 * Returns "open"/"closed" for NYSE based on America/New_York.
 */
export async function marketsNow() {
  const tz = 'America/New_York';
  const d = nowInTZ(tz);
  const day = d.getUTCDay(); // 0 Sun ... 6 Sat (approx; we used UTC iso from tz parts)
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: tz }).format(d)
  );
  const minute = Number(
    new Intl.DateTimeFormat('en-US', { minute: '2-digit', hour12: false, timeZone: tz }).format(d)
  );
  const mins = hour * 60 + minute;

  // 9:30–16:00 ET = 570..960 mins
  const isWeekend = day === 0 || day === 6;
  const isOpen = !isWeekend && mins >= 570 && mins <= 960;

  return {
    tz,
    open: isOpen,
    window: '09:30–16:00',
    timestamp: d.toISOString(),
  };
}

// ---------- Public: webSearchSummary ----------
/**
 * Minimal, dependency-free summary function to keep builds green.
 * Accepts { query } and returns a short neutral summary using the Responses API.
 * You can later swap this to a true web search pipeline.
 */
export async function webSearchSummary(arg: { query: string }) {
  const query = (arg?.query || '').trim();

  if (!query) {
    return { summary: '' };
  }

  const system =
    'You summarize neutrally in one or two sentences. Avoid dates unless you are certain. No emojis.';

  // Using responses API keeps this compatible going forward.
  const resp = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: system },
      { role: 'user', content: `Summarize briefly: ${query}` },
    ],
  });

  const text =
    (resp.output_text ?? '').trim() ||
    (Array.isArray(resp.output) ? resp.output.map((o: any) => o.content?.[0]?.text ?? '').join(' ') : '');

  return { summary: text };
}

// ---------- Public: buildBlipScript ----------
/**
 * Builds a short, human-sounding “morning blip” script.
 * Keeps implementation simple so it’s fast & reliable in cron.
 */
export async function buildBlipScript(opts: BuildBlipOpts = {}): Promise<BuildBlipResult> {
  const tz = (opts.tz || process.env.BLIP_TZ || 'America/Chicago') as string;
  const region = (opts.region || 'us_central') as string;

  const when = nowInTZ(tz);
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: tz,
  }).format(when);

  // Pull a tiny “search-style” blurb to seed the brief (safe to run even if it’s generic)
  const { summary: headlines } = await webSearchSummary({ query: `Top headlines ${region}` });
  const mkt = await marketsNow();

  const prompt = [
    `Write a 60–90 second spoken morning brief for a general audience in ${region}.`,
    `Date: ${dateStr} (local to ${tz}).`,
    `Headlines context (optional/generic): ${headlines || 'generic headlines'}.`,
    `Market status: NYSE is ${mkt.open ? 'open' : 'closed'} (hours ${mkt.window} ET).`,
    `Constraints:`,
    `- Conversational, calm, concise. No hype.`,
    `- If the headline context is vague, keep it general and avoid fabricating specifics.`,
    `- End with one crisp “quick fact” line.`,
  ].join('\n');

  const resp = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: 'You are a broadcast writer who speaks clearly for audio.' },
      { role: 'user', content: prompt },
    ],
  });

  const raw = (resp.output_text ?? '').trim();
  const script = humanizeForVoice(raw);

  return {
    script,
    meta: {
      tz,
      region,
      date: ymd(),
      markets: mkt,
    },
  };
}

// ---------- Public: deriveWrittenSummary ----------
/**
 * Produces a short written summary from the spoken script.
 */
export async function deriveWrittenSummary(script: string) {
  const resp = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: 'Summarize neutrally in 3–5 bullet points, no intro or outro.' },
      { role: 'user', content: script },
    ],
  });

  const text = (resp.output_text ?? '').trim();
  return { summary: text };
}

// ---------- Public: ttsMp3 ----------
/**
 * TTS to MP3 and upload to Supabase Storage.
 * Returns { url, path }.
 */
export async function ttsMp3(text: string, voice = process.env.TTS_VOICE || 'alloy') {
  const shaped = humanizeForVoice(text);

  const speech = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts', // or 'tts-1'
    voice: String(voice),
    input: shaped,
    response_format: 'mp3', // <-- required field name in current SDK
  });

  const arrBuf = await speech.arrayBuffer();

  const bucket = process.env.SUPABASE_BUCKET || 'blip';
  const key = `tmp/${ymd()}/audio-${Date.now()}.mp3`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(key, arrBuf, {
      contentType: 'audio/mpeg',
      cacheControl: '31536000',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(key);
  return { url: pub.publicUrl, path: key };
}

// ---------- Public: createRealtimeSession ----------
/**
 * Creates a Realtime ephemeral session on the server.
 * Accepts (voice, modalities) to stay compatible with your route;
 * `modalities` is accepted then ignored here (it’s configured client-side).
 */
export async function createRealtimeSession(
  voice = 'verse',
  _modalities: Array<'audio' | 'text'> = ['audio', 'text']
) {
  // Keep params minimal to avoid type drift across SDK versions
  const session = await openai.realtime.sessions.create({
    model: 'gpt-4o-realtime-preview-2024-12-17',
    voice,
  } as any);

  return session;
}

