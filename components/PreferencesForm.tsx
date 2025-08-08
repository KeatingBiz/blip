'use client';
import { useEffect, useState } from 'react';
import type { Preferences, TopicsKey } from '../lib/types';
import { getPrefs, savePrefs } from '../lib/api';

const ALL: TopicsKey[] = [
  'top', 'markets', 'tech', 'sports', 'world',
  'us', 'local', 'business', 'science', 'health'
];

export default function PreferencesForm({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Preferences>({
    user_id: userId,
    topics: ['top', 'markets'],
    tickers: ['SPY', 'BTC-USD'],
    delivery_hour: 7,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { preferences } = await getPrefs(userId).catch(() => ({ preferences: null }));
      if (preferences) setPrefs(prev => ({ ...prev, ...preferences }));
      setLoading(false);
    })();
  }, [userId]);

  async function onSave() {
    setSaving(true);
    try { await savePrefs(prefs); } finally { setSaving(false); }
  }

  function toggleTopic(t: TopicsKey) {
    setPrefs(p => ({
      ...p,
      topics: p.topics?.includes(t)
        ? p.topics!.filter(x => x !== t)
        : [...(p.topics || []), t],
    }));
  }

  return (
    <div className="card">
      <h3>Preferences</h3>
      {loading ? (
        <div className="small">Loading…</div>
      ) : (
        <div className="row">
          <div style={{ flex: '1 1 320px' }}>
            <label className="label">Location (optional)</label>
            <input
              className="input"
              value={prefs.location || ''}
              onChange={e => setPrefs({ ...prefs, location: e.target.value })}
              placeholder="City, ST"
            />
          </div>

          <div style={{ flex: '1 1 320px' }}>
            <label className="label">Tickers (comma-separated)</label>
            <input
              className="input"
              value={(prefs.tickers || []).join(', ')}
              onChange={e =>
                setPrefs({
                  ...prefs,
                  tickers: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                })
              }
              placeholder="SPY, BTC-USD"
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Delivery hour</label>
            <input
              className="input"
              type="number"
              min={0}
              max={23}
              value={prefs.delivery_hour || 7}
              onChange={e => setPrefs({ ...prefs, delivery_hour: Number(e.target.value) })}
            />
          </div>

          <div style={{ flex: '1 1 260px' }}>
            <label className="label">Timezone</label>
            <input
              className="input"
              value={prefs.timezone || ''}
              onChange={e => setPrefs({ ...prefs, timezone: e.target.value })}
            />
          </div>

          <div style={{ flex: '1 1 100%' }}>
            <label className="label">Topics</label>
            <div className="row">
              {ALL.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTopic(t)}
                  className="badge"
                  aria-pressed={prefs.topics?.includes(t)}
                >
                  <input type="checkbox" readOnly checked={!!prefs.topics?.includes(t)} /> {t}
                </button>
              ))}
            </div>
          </div>

          <div className="hr" />
          <div>
            <button className="btn primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
