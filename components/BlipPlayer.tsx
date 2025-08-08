'use client';
import { useState } from 'react';
import { getBlipFree, getBlipPremium } from '../lib/api';

export default function BlipPlayer({ plan, userId }:{ plan:'free'|'premium'; userId:string }){
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string|undefined>();
  const [script, setScript] = useState('');
  const [summary, setSummary] = useState('');
  const [cohort, setCohort] = useState<string|undefined>();
  const [error, setError] = useState<string|undefined>();

  async function fetchFree(){ setLoading(true); setError(undefined); try {
    const r = await getBlipFree(); setAudioUrl(r.audioUrl); setScript(r.script); setSummary(r.summary); setCohort(r.cohort);
  } catch(e:any){ setError(e?.message||'Failed to load free blip'); }
  finally { setLoading(false); } }

  async function fetchPremium(){ setLoading(true); setError(undefined); try {
    const r = await getBlipPremium(userId); setAudioUrl(r.audioUrl); setScript(r.script); setSummary(r.summary); setCohort(undefined);
  } catch(e:any){ setError(e?.message||'Failed to load premium blip'); }
  finally { setLoading(false); } }

  return (
    <div className="card">
      <div className="row" style={{alignItems:'center', justifyContent:'space-between'}}>
        <h3 style={{margin:0}}>Morning Blip</h3>
        <span className={`pill ${plan==='premium'?'success':''}`}>{plan==='premium'?'Personalized (Premium)':'Free cohort'}</span>
      </div>
      <div className="row center" style={{marginTop:8}}>
        <button className="btn primary" onClick={fetchFree} disabled={loading}>
          {loading ? <span className="spinner"/> : 'Your Morning Blip is Ready!'}
        </button>
        {plan==='premium' && (
          <button className="btn outline" onClick={fetchPremium} disabled={loading}>
            {loading ? 'Loading…' : 'Get Personalized Blip (Premium)'}
          </button>
        )}
      </div>

      {error && <div className="small" style={{color:'#b91c1c', marginTop:8}}>Error: {error}</div>}
      {cohort && <div className="small" style={{marginTop:6}}>Cohort key: {cohort}</div>}
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
