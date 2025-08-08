// lib/openai.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* --------------------------- Prosody / speech shaping --------------------------- */
function shapeForSpeech(raw: string) {
  let s = (raw || '').trim();

  // Remove shouty headers like "MARKETS:" etc.
  s = s.replace(/^(?:[A-Z][A-Z\s/&-]{2,}):\s*$/gm, '');

  // Convert lingering "Header: line" to a natural intro
  s = s.replace(/^([A-Z][A-Za-z0-9\s/&-]{2,30}):\s+/gm, (_m, h) => `${h} — `);

  // Light pauses between paragraphs
  s = s.replace(/\n{2,}/g, ' … ');

  // Micro-tweaks that read better aloud
  s = s.replace(/\bS&P\s*500\b/gi, 'S and P five hundred');
  s = s.replace(/\bNASDAQ\b/gi, 'Nas-dak');
  s = s.replace(/\b%/g, ' percent');

  // Normalize whitespace
  s = s.replace(/[ \t]+/g, ' ').replace(/ ?— ?/g, ' — ');
  return s.trim();
}

/* ---------------------------- Blip script + summary ---------------------------- */
export async function buildBlipScript(opts: {
  topics?: string[];
  tickers?: string[];
  location?: string;
  persona?: 'neutral' | 'calm' | 'energetic';
} = {}) {
  const personaEnv =
    (process.env.BLIP_PERSONA as 'neutral' | 'calm' | 'energetic') || 'calm';

  const {
    topics = ['top', 'markets', 'world'],
    tickers = [],
    location = '',
    persona = personaEnv,
  } = opts;

  const vibe =
    persona === 'energetic'
      ? 'friendly, upbeat morning-show energy'
      : persona === 'calm'
      ? 'calm, confident NPR-style cadence'
      : 'neutral, clear and concise delivery';

  const system = [
    'You write short, natural spoken briefs for a morning audio update.',
    'No section headers. No bullets. No metadata. Output only what a host would say.',
    'Use short sentences (8–16 words). Use natural transitions. Avoid jargon.',
    "Say numbers like people do: 'three point two percent', not '3.2%'.",
    "On first mention, expand tickers to company names, e.g., 'Apple (AAPL)'.",
    'Target 60 to 75 seconds total. End with one warm sign-off line.',
  ].join(' ');

  const user = [
    `Tone: ${vibe}.`,
    location ? `If relevant, include one local item for ${location}.` : '',
    tickers.length ? `If relevant, briefly mention: ${tickers.join(', ')}.` : '',
    `Main areas today: ${topics.join(', ')}.`,
    'Output the final spoken script only.',
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
  });

  const raw = completion.choices?.[0]?.message?.content?.toString() || '';
  return shapeForSpeech(raw);
}

export async function deriveWrittenSummary(script: string) {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Summarize the following spoken script in 1–3 short sentences. No bullets. Plain text.',
      },
      { role: 'user', content: script },
    ],
    temperature: 0.4,
  });
  return (completion.choices?.[0]?.message?.content || '').trim();
}

/* ------------------------------------ TTS ------------------------------------- */
export async function ttsMp3(text: string, fallbackVoice?: string) {
  const voice = process.env.TTS_VOICE || fallbackVoice || 'verse';
  const shaped = shapeForSpeech(text);

  const audio = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input: shaped,
    format: 'mp3',
  });

  const arrayBuf = await audio.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/* ------------------------- Realtime ephemeral session -------------------------- */
/**
 * Creates a short-lived client_secret for the Realtime API.
 * Returns the raw JSON from OpenAI (includes client_secret.value).
 * Docs: POST https://api.openai.com/v1/realtime/sessions
 */
export async function createRealtimeSession(opts?: {
  model?: string;
  voice?: string;
  instructions?: string;
}) {
  const model =
    opts?.model ||
    process.env.REALTIME_MODEL ||
    'gpt-4o-mini-realtime-preview'; // or 'gpt-4o-realtime-preview'
  const voice = opts?.voice || process.env.TTS_VOICE || 'verse';
  const instructions =
    opts?.instructions ||
    'You are a helpful, concise voice assistant for Blip. Answer briefly and clearly.';

  const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      instructions,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to create realtime session: ${res.status} ${txt}`);
  }
  return res.json();
}

/* ----------------------- Placeholder “tools” for voice ------------------------ */
/**
 * marketsNow: quick, generic snapshot text (no live quotes).
 * Safe placeholder so your Voice routes compile and respond.
 */
export async function marketsNow(args?: { tickers?: string[] }) {
  const tickers = (args?.tickers || []).filter(Boolean);
  const prompt = [
    'Provide a short, plain-English snapshot of today’s U.S. markets.',
    'No investment advice. No specific prices since live quotes are not connected.',
    tickers.length ? `If relevant, mention: ${tickers.join(', ')}.` : '',
    '3–5 sentences max.',
  ].join(' ');
  const c = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.5,
    messages: [
      { role: 'system', content: 'You write neutral market snapshots without fabricating numbers.' },
      { role: 'user', content: prompt },
    ],
  });
  return (c.choices[0]?.message?.content || '').trim();
}

/**
 * webSearchSummary: placeholder summarizer (no live web fetch).
 * We’ll swap this later for a real search/scrape pipeline.
 */
export async function webSearchSummary(args: { query: string }) {
  const q = (args?.query || '').trim();
  if (!q) return 'No query provided.';
  const c = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.4,
    messages: [
      { role: 'system', content: 'Summarize succinctly in 3–5 sentences based on general knowledge. If uncertain, say what’s uncertain.' },
      { role: 'user', content: `Topic: ${q}\nProvide a neutral, high-level summary without pretending to have live web data.` },
    ],
  });
  return (c.choices[0]?.message?.content || '').trim();
}
