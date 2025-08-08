'use client';
import { useState } from 'react';
import { getBlipFree, getBlipPremium } from '../lib/api';

export default function BlipPlayer({ plan, userId }: { plan: 'free' | 'premium'; userId: string }) {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [script, setScript] = useState('');
  const [summary, setSummary] = useState('');

  async function fetchFree() {
    setLoading(true);
    try {
      const r = await getBlipFree();
      setAudioUrl(r.audioUrl);
      setScript(r.script);
      setSummary(r.summary);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPremium() {
    setLoading(true);
    try {
      const r = await getBlipPremium(userId);
      setAudioUrl(r.audioUrl);
      setScript(r.script);
      setSummary(r.summary);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3>Morning Blip</h3>
      <div className="row">
        <button className="btn" onClick={fetchFree} disabled={loading}>
          {loading ? 'Loading…' : "Get Today's Blip (Free Cohort)"}
        </button>
        {plan === 'premium' && (
          <button className="btn primary" onClick={fetchPremium} disabled={loading}>
            {loading ? 'Loading…' : 'Get Personalized Blip (Premium)'}
          </button>
        )}
      </div>

      {audioUrl && <audio className="audio" src={audioUrl} controls autoPlay />}

      {summary && (
        <div style={{ marginTop: 12 }}>
          <div className="label">Summary</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{summary}</div>
        </div>
      )}

      {script && (
        <details style={{ marginTop: 12 }}>
          <summary>Full Script</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{script}</pre>
        </details>
      )}
    </div>
  );
}
