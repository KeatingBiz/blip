'use client';
import { useState } from 'react';
import { getBlipFree } from '../lib/api';

export default function BlipPlayer({ plan, userId }:{ plan:'free'|'premium'; userId:string }){
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string|undefined>();
  const [script, setScript] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string|undefined>();

  async function fetchBlip(){
    setLoading(true); setError(undefined);
    try{
      const r = await getBlipFree();
      setAudioUrl(r.audioUrl);
      setScript(r.script);
      setSummary(r.summary);
    }catch(e:any){
      setError(e?.message || 'Failed to load blip');
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="row center" style={{marginTop:4}}>
        <button className="btn primary" onClick={fetchBlip} disabled={loading}>
          {loading ? <span className="spinner"/> : 'Your Morning Blip is Ready!'}
        </button>
      </div>

      {error && <div className="small" style={{color:'#b91c1c', marginTop:8}}>Error: {error}</div>}
      {audioUrl && <audio className="audio" src={audioUrl} controls autoPlay />}

      {summary && (
        <div style={{marginTop:12}}>
          <div className="label">Summary</div>
          <div style={{whiteSpace:'pre-wrap'}}>{summary}</div>
        </div>
      )}

      {script && (
        <details style={{marginTop:12}}>
          <summary>Full Script</summary>
          <pre style={{whiteSpace:'pre-wrap'}}>{script}</pre>
        </details>
      )}
    </div>
  );
}

