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
      <div className="row" style={{alignItems:'center', justifyContent:'space-between'}}>
        <h2>Blip</h2>
        <button className="btn" onClick={togglePlan}>Plan: <b>{plan}</b> (toggle)</button>
      </div>

      <div className="tabbar">
        <button className={`tab ${tab==='blip'?'active':''}`} onClick={()=>setTab('blip')}>Morning Blip</button>
        <button className={`tab ${tab==='prefs'?'active':''}`} onClick={()=>setTab('prefs')}>Preferences</button>
        <button className={`tab ${tab==='voice'?'active':''}`} onClick={()=>setTab('voice')}>Voice (Premium)</button>
      </div>

      {tab==='blip' && <BlipPlayer plan={plan} userId={userId} />}
      {tab==='prefs' && userId && <PreferencesForm userId={userId} />}
      {tab==='voice' && plan==='premium'
        ? <VoiceAgent/>
        : (tab==='voice' && <div className="card"><div className="small">Upgrade to premium to use the live voice agent.</div></div>)
      }

      <div className="hr" />
      <div className="small">User: {userId ? userId.slice(0,8) : ''}… • Demo uses local storage for identity and plan.</div>
    </div>
  );
}

