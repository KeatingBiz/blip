// lib/openai.ts
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// -------------------- Clients --------------------
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// -------------------- Model presets --------------------
export const MODELS = {
  BLIP_TEXT: 'gpt-5-mini',      // main blip script
  BLIP_SUMMARY: 'gpt-5-nano',   // bullets + search blurbs
  TTS: process.env.TTS_MODEL || 'gpt-4o-mini-tts', // or 'tts-1' / 'tts-1-hd'
  REALTIME: 'gpt-4o-realtime-preview-2024-12-17',  // keep 4o realtime for now
};

// -------------------- Types --------------------
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

// -------------------- Small helpers --------------------
function nowInTZ(tz?: string) {
  const d = new Date();
  if (!tz) return d;

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

  const year = get('year');
  const month = get('month');
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
  return text.replace(/\s+/g, ' ').replace(/%/g, ' percent').trim();
}

// -------------------- marketsNow --------------------
/** Lightweight NYSE open/closed guess (no holiday logic). */
export async function marketsNow() {
  const tz = 'America/New_York';
  const d = nowInTZ(tz);

  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: tz }).format(d)
  );
  const minute = Number(
    new Intl.DateTimeFormat('en-US', { minute: '2-digit', hour12: false, timeZone: tz }).format(d)
  );
  const weekday = Number(
    new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz })
      .format(d)
      .match(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/) ? 1 : 0 // dummy use to avoid ts complaints
  );
  const jsDay = new Date(d.toISOString()).getUTCDay(); // fine for "now" checks
  const mins = hour * 60 + minute;

  const isWeekend = jsDay === 0 || jsDay === 6;
  // 9:30–16:00 ET = 570..960
  const isOpen = !isWeekend && mins >= 570 && mins <= 960;

  return { tz, open: isOpen, window: '09:30–16:00', timestamp: d.toISOString() };
}

// -------------------- webSearchSummary --------------------
/**
 * Minimal neutral summary. Accepts { query, maxChars? }.
 * Swap this later for a real search+grounding step.
 */
export async function webSearchSummary(arg: { query: string; maxChars?: number }) {
  const query = (arg?.query || '').trim();
  const maxChars = arg?.maxChars && arg.maxChars > 0 ? arg.maxChars : undefined;

  if (!query) return { summary: '' };

  const resp = await openai.responses.create({
    model: MODELS.BLIP_SUMMARY,
    input: [
      { role: 'system', content: 'Summarize neutrally in one or two sentences. No emojis.' },
      { role: 'user', content: `Summarize briefly: ${query}` },
    ],
  });

  let text = (resp.output_text ?? '').trim();
  if (maxChars && text.length > maxChars) {
    text = text.slice(0, maxChars - 1).trimEnd() + '…';
  }
  return { summary: text };
}

// -------------------- buildBlipScript --------------------
export async function buildBlipScript(opts: BuildBlipOpts = {}): Promise<BuildBlipResult> {
  const tz = (opts.tz || process.env.BLIP_TZ || 'America/Chicago') as string;
  const region = (opts.region || 'us_central') as string;

  const when = nowInTZ(tz);
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: tz,
  }).format(when);

  const { summary: headlines } = await webSearchSummary({ query: `Top headlines ${region}`, maxChars: 200 });
  const mkt = await marketsNow();

  const prompt = [
    `Write a 60–90 second spoken morning brief for a general audience in ${region}.`,
    `Date: ${dateStr} (local to ${tz}).`,
    `Headlines context (optional): ${headlines || 'generic headlines'}.`,
    `Market status: NYSE is ${mkt.open ? 'open' : 'closed'} (hours ${mkt.window} ET).`,
    `Constraints:`,
    `- Conversational, calm, concise. Avoid hype and speculation.`,
    `- If context is vague, keep it general and avoid fabricating specifics.`,
    `- End with a single quick fact.`,
  ].join('\n');

  const resp = await openai.responses.create({
    model: MODELS.BLIP_TEXT, // gpt-5-mini
    input: [
      { role: 'system', content: 'You are a broadcast writer who speaks clearly for audio.' },
      { role: 'user', content: prompt },
    ],
  });

  const raw = (resp.output_text ?? '').trim();
  const script = humanizeForVoice(raw);

  return { script, meta: { tz, region, date: ymd(), markets: mkt } };
}

// -------------------- deriveWrittenSummary --------------------
export async function deriveWrittenSummary(script: string) {
  const resp = await openai.responses.create({
    model: MODELS.BLIP_SUMMARY, // gpt-5-nano
    input: [
      { role: 'system', content: 'Summarize neutrally in 3–5 bullet points, no intro or outro.' },
      { role: 'user', content: script },
    ],
  });

  const text = (resp.output_text ?? '').trim();
  return { summary: text };
}

// -------------------- ttsMp3 --------------------
/** TTS to MP3 and upload to Supabase Storage. Returns { url, path }. */
export async function ttsMp3(text: string, voice = process.env.TTS_VOICE || 'alloy') {
  const shaped = humanizeForVoice(text);

  const speech = await openai.audio.speech.create({
    model: MODELS.TTS,            // 'gpt-4o-mini-tts' or 'tts-1' / 'tts-1-hd'
    voice: String(voice),
    input: shaped,
    response_format: 'mp3',       // NOTE: current SDK uses response_format
  });

  const arrBuf = await speech.arrayBuffer();

  const bucket = process.env.SUPABASE_BUCKET || 'blip';
  const key = `tmp/${ymd()}/audio-${Date.now()}.mp3`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(key, Buffer.from(arrBuf), {
      contentType: 'audio/mpeg',
      cacheControl: '31536000',
      upsert: true,
    });

  if (error) throw error;

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(key);
  return { url: pub.publicUrl, path: key };
}

// -------------------- createRealtimeSession --------------------
/**
 * Accepts either:
 *  - (voice?: string, modalities?: Array<'audio' | 'text'>)
 *  - ({ voice?, model?, instructions?, modalities? })
 * Returns the Realtime session (with client_secret if supported by the SDK).
 */
type RealtimeSessionOptions = {
  voice?: string;
  model?: string;
  instructions?: string;
  modalities?: Array<'audio' | 'text'>;
};

export async function createRealtimeSession(
  arg1?: string | RealtimeSessionOptions,
  arg2?: Array<'audio' | 'text'>
) {
  let voice = 'verse';
  let model = MODELS.REALTIME;
  let instructions: string | undefined;
  let modalities: Array<'audio' | 'text'> = ['audio', 'text'];

  if (typeof arg1 === 'string' || arg1 === undefined) {
    // Old style: (voice, modalities?)
    if (typeof arg1 === 'string') voice = arg1;
    if (Array.isArray(arg2)) modalities = arg2;
  } else {
    // New style: ({ voice, model, instructions, modalities })
    voice = arg1.voice ?? voice;
    model = arg1.model ?? model;
    instructions = arg1.instructions ?? instructions;
    modalities = arg1.modalities ?? modalities;
  }

  // Cast to any to avoid type drift between SDK versions.
  const session = await (openai as any).realtime.sessions.create({
    model,
    voice,
    ...(instructions ? { instructions } : {}),
    ...(modalities ? { modalities } : {}),
  });

  return session;
}
