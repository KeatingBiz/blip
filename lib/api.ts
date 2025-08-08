import type { Preferences } from './types';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    // Important on Vercel/Next: always hit same-origin relative routes
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${url} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---- Users / Prefs ----
export function upsertUser(user_id: string, email?: string, plan?: 'free' | 'premium') {
  return api<{ ok: true }>('/api/user/upsert', {
    method: 'POST',
    body: JSON.stringify({ user_id, email, plan }),
  });
}

export function getPrefs(user_id: string) {
  return api<{ preferences: Preferences | null }>(`/api/user/preferences?user_id=${encodeURIComponent(user_id)}`);
}

export function savePrefs(prefs: Preferences) {
  return api<{ ok: true }>('/api/user/preferences', {
    method: 'POST',
    body: JSON.stringify(prefs),
  });
}

// ---- Blips ----
export function getBlipFree() {
  return api<{ audioUrl: string; script: string; summary: string; cohort: string }>(
    '/api/blip/generate',
    { method: 'POST', body: JSON.stringify({ mode: 'free' }) }
  );
}

export function getBlipPremium(user_id: string) {
  return api<{ audioUrl: string; script: string; summary: string }>(
    '/api/blip/generate',
    { method: 'POST', body: JSON.stringify({ user_id }) }
  );
}

// ---- Realtime / Tools ----
export function getEphemeral() {
  return api<{ client_secret: string; id?: string; expires_at?: string }>(
    '/api/auth/ephemeral',
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export function marketSnapshot() {
  return api<{ text: string; citations: any[] }>('/api/tools/markets');
}

export function webSearch(query: string) {
  return api<{ text: string; citations: any[] }>(
    '/api/tools/search',
    { method: 'POST', body: JSON.stringify({ query }) }
  );
}
