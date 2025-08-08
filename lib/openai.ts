// lib/openai.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// --- Prosody helper: make copy sound like a human reading it ---
function shapeForSpeech(raw: string) {
  let s = (raw || '').trim();

  // Remove shouty headers like "MARKETS:" or "WORLD NEWS:"
  s = s.replace(/^(?:[A-Z][A-Z\s/&-]{2,}):\s*$/gm, '');

  // Convert lingering "Header: line" to a natural intro
  s = s.replace(
    /^([A-Z][A-Za-z0-9\s/&-]{2,30}):\s+/gm,
    (_m, h) => `${h} — `
  );

  // Insert light pauses between paragraphs
  s = s.replace(/\n{2,}/g, ' … ');

  // Micro-tweaks that read better aloud
  s = s.replace(/\bS&P\s*500\b/gi, 'S and P five hundred');
  s = s.replace(/\bNASDAQ\b/gi, 'Nas-dak');
  s = s.replace(/\b%/g, ' percent');

  // Normalize whitespace / dash spacing
  s = s.replace(/[ \t]+/g, ' ').replace(/ ?— ?/g, ' — ');
  return s.trim();
}

// --- Script builder: no labels, spoken copy (≈60–75s) ---
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

// --- Summary for the UI card (1–3 short sentences) ---
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

// --- Text-to-speech: pick voice via env var (TTS_VOICE) ---
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

