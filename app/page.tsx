'use client';
import { useEffect, useState } from 'react';
import BlipPlayer from '../components/BlipPlayer';
import PreferencesForm from '../components/PreferencesForm';
import VoiceAgent from '../components/VoiceAgent';
import { upsertUser } from '../lib/api';
import './globals.css';

export default function Page(){
  const [tab, setTab] = useState<'blip'|'prefs'|'voice'>('blip');
  const [userId, setUserId] = useState('');
  const [plan, setPlan] = useState<'free'|'premium'>(
    (typeof window!=='undefined' && (localStorage.getItem('plan') as any)) || 'free'
  );

  useEffect(()=>{
    let id = localStorage.getItem('user_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('user_id', id); }
    setUserId(id);
    upsertUser(id, undefined, plan).catch(()=>{});
  },[]);

  function togglePlan(){
    const next = plan==='free'?'premium':'free';
    setPlan(next); localStorage.setItem('plan', next);
    if (userId) upsertUser(userId, undefined, next).catch(()=>{});
  }

  return (
    <div className="container">
      {/* BIG centered logo + title */}
      <div className="brand">
        {/* If you uploaded a PNG, use /logo-b.png. If SVG, use /logo-b.svg */}
        <img src="/logo-b.png" alt="Blip logo"
             onError={(e)=>{(e.target as HTMLImageElement).style.display='none'}} />
        <div style={{textAlign:'center'}}>
          <h1>Blip</h1>
          <div className="sub">Your AI Morning Brief</div>
        </div>
      </div>

      {/* Tabs right under the logo */}
      <div className="tabbar">
        <button className={`tab ${tab==='blip'?'active':''}`} onClick={()=>setTab('blip')}>Morning Blip</button>
        <button className={`tab ${tab==='prefs'?'active':''}`} onClick={()=>setTab('prefs')}>Preferences</button>
        <button className={`tab ${tab==='voice'?'active':''}`} onClick={()=>setTab('voice')}>Voice (Premium)</button>
      </div>

      {/* Content card */}
      {tab==='blip' && <BlipPlayer plan={plan} userId={userId} />}
      {tab==='prefs' && userId && <PreferencesForm userId={userId} />}
      {tab==='voice' && plan==='premium'
        ? <VoiceAgent/>
        : (tab==='voice' && <div className="card"><div className="small">Upgrade to premium to use the live voice agent.</div></div>)
      }

      {/* Plan toggle now at the very bottom */}
      <div className="hr" />
      <div className="center" style={{marginTop:6}}>
        <button className="btn outline" onClick={togglePlan}>Plan: <b>{plan}</b> (toggle)</button>
      </div>

      {/* User id is intentionally hidden now */}
    </div>
  );
}

