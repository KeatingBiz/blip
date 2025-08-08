// lib/openai.ts
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';
export const WRITER_MODEL =
  process.env.OPENAI_WRITER_MODEL || 'gpt-4o-mini';
export const TTS_MODEL =
  process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';

// Create a short-lived Realtime session (client uses client_secret over WebRTC)
export async function createRealtimeSession(
  voice: string = 'verse',
  modalities: Array<'audio' | 'text'> = ['audio', 'text']
) {
  return openai.realtime.sessions.create({
    model: REALTIME_MODEL,
    voice,
    modalities,
  });
}

// Use Responses API + built-in web_search to get a concise, sourced blurb
export async function webSearchSummary(query: string, maxWords = 140) {
  const res = await openai.responses.create({
    model: WRITER_MODEL,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Search the web and provide a concise, sourced update. Query: ${query}. Max ${maxWords} words.`,
          },
        ],
      },
    ],
    tools: [{ type: 'web_search' }],
  });

  const text = res.output_text || '';
  const citations =
    ((res.output?.[0] as any)?.content as any[])?.filter?.(
      (c: any) => c.type === 'citation'
    ) || [];
  return { text, citations };
}

// Write a 60–90s spoken script focused on "what changed since yesterday"
export async function buildBlipScript(opts: {
  topics: string[];
  tickers?: string[];
  location?: string;
  persona?: 'neutral' | 'friendly';
}) {
  const { topics, tickers = [], location = '', persona = 'neutral' } = opts;
  const topicsLine = topics.join(', ');
  const prompt = `Write a 60–90 second spoken morning news script focused on WHAT CHANGED since yesterday and WHY IT MATTERS.
Include categories: ${topicsLine}.
${tickers.length ? `Tickers: ${tickers.join(', ')}.` : ''}
${location ? `Local focus: ${location}.` : ''}
Keep sentences short. Conversational ${persona}. Include brief attributions inline (e.g., per Reuters/Bloomberg/official data).`;

  const res = await openai.chat.completions.create({
    model: WRITER_MODEL,
    temperature: 0.6,
    max_tokens: 700,
    messages: [
      { role: 'system', content: 'You are Blip, a neutral, concise morning brief writer.' },
      { role: 'user', content: prompt },
    ],
  });

  return res.choices?.[0]?.message?.content?.trim() || '';
}

// Convert the script into a 4–6 bullet typed summary
export async function deriveWrittenSummary(script: string) {
  const res = await openai.chat.completions.create({
    model: WRITER_MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: 'Summarize into 4–6 crisp bullets with one-liner “why it matters.” No fluff.' },
      { role: 'user', content: script },
    ],
  });
  return res.choices?.[0]?.message?.content?.trim() || '';
}

// Text-to-speech MP3 buffer
export async function ttsMp3(text: string, voice: string = 'verse') {
  const audio = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice,
    input: text,
    format: 'mp3',
  });
  const buf = Buffer.from(await audio.arrayBuffer());
  return buf;
}

// Quick markets snapshot via web_search
export async function marketsNow(
  tickers: string[] = ['SPY', 'QQQ', 'DIA', 'BTC-USD', 'ETH-USD']
) {
  const q = `Latest snapshot today for ${tickers.join(', ')}, key moves and drivers.`;
  return webSearchSummary(q, 90);
}
