'use client';
import { useEffect, useState } from 'react';
import type { Preferences, TopicsKey } from '../lib/types';
import { getPrefs, savePrefs } from '../lib/api';

const ALL: TopicsKey[] = ['top','markets','tech','sports','world','us','local','business','science','health'];

export default function PreferencesForm({ userId, plan }:{ userId:string; plan:'free'|'premium' }){
  const [prefs, setPrefs] = useState<Preferences>({
    user_id:userId,
    topics:['top','markets'],
    tickers:['SPY','BTC-USD'],
    delivery_hour:7,
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const readOnly = plan !== 'premium';

  useEffect(()=>{(async()=>{
    const { preferences } = await getPrefs(userId).catch(()=>({preferences:null}));
    if (preferences) setPrefs(prev=>({ ...prev, ...preferences }));
    setLoading(false);
  })()},[userId]);

  async function onSave(){
    if (readOnly) return; // guard
    setSaving(true); setSaved(false);
    try { await savePrefs(prefs); setSaved(true); setTimeout(()=>setSaved(false), 2000); }
    finally { setSaving(false); }
  }

  function toggleTopic(t:TopicsKey){
    if (readOnly) return;
    setPrefs(p => ({...p, topics: p.topics?.includes(t) ? p.topics!.filter(x=>x!==t) : [...(p.topics||[]), t] }));
  }

  const disabledStyle = readOnly ? { opacity:.6, pointerEvents:'none' as const } : undefined;

  return (
    <div className="card">
      <div className="row" style={{alignItems:'center', justifyContent:'space-between'}}>
        <h3 style={{margin:0}}>Preferences</h3>
        {saved && !readOnly && <span className="pill success">Saved ✓</span>}
        {readOnly && <span className="pill">Premium feature</span>}
      </div>

      {readOnly && (
        <div className="small" style={{marginTop:6}}>
          Customize topics, tickers, delivery time, and timezone with <b>Premium</b>.
        </div>
      )}

      {loading ? <div className="small" style={{marginTop:8}}>Loading…</div> : (
        <div className="row" style={disabledStyle}>
          <div style={{flex:'1 1 320px'}}>
            <label className="label">Location (optional)</label>
            <input className="input" value={prefs.location||''}
                   onChange={e=>setPrefs({...prefs, location:e.target.value})}
                   placeholder="City, ST" disabled={readOnly} />
          </div>
          <div style={{flex:'1 1 320px'}}>
            <label className="label">Tickers (comma-separated)</label>
            <input className="input" value={(prefs.tickers||[]).join(', ')}
                   onChange={e=>setPrefs({...prefs, tickers:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                   placeholder="SPY, BTC-USD" disabled={readOnly} />
          </div>
          <div style={{flex:'1 1 200px'}}>
            <label className="label">Delivery hour</label>
            <input className="input" type="number" min={0} max={23}
                   value={prefs.delivery_hour||7}
                   onChange={e=>setPrefs({...prefs, delivery_hour:Number(e.target.value)})}
                   disabled={readOnly} />
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label className="label">Timezone</label>
            <input className="input" value={prefs.timezone||''}
                   onChange={e=>setPrefs({...prefs, timezone:e.target.value})}
                   disabled={readOnly} />
          </div>

          <div style={{flex:'1 1 100%'}}>
            <label className="label">Topics</label>
            <div className="row">
              {ALL.map(t => {
                const active = !!prefs.topics?.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={()=>toggleTopic(t)}
                    className="badge"
                    aria-pressed={active}
                    disabled={readOnly}
                    style={readOnly ? { cursor:'not-allowed' } : undefined}
                  >
                    <input type="checkbox" readOnly checked={active} /> {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hr" />
          <div>
            <button className="btn primary" onClick={onSave} disabled={readOnly || saving}>
              {readOnly ? 'Upgrade to edit (Premium)' : (saving ? <span className="spinner"/> : 'Save Preferences')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

