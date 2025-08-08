'use client';
import { useEffect, useRef, useState } from 'react';
import { getEphemeral, marketSnapshot, webSearch } from '../lib/api';

export default function VoiceAgent(){
  const audioRef = useRef<HTMLAudioElement>(null);
  const [active, setActive] = useState(false);
  const [pc, setPc] = useState<RTCPeerConnection|null>(null);
  const [busy, setBusy] = useState(false);
  const [lastTool, setLastTool] = useState<string>('');

  async function start(){
    setBusy(true);
    try{
      const token = await getEphemeral();
      const _pc = new RTCPeerConnection();
      setPc(_pc);
      const stream = new MediaStream();
      _pc.ontrack = (e)=>{
        if (!audioRef.current) return;
        stream.addTrack(e.track);
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(()=>{});
      };
      const ms = await navigator.mediaDevices.getUserMedia({ audio:true });
      ms.getTracks().forEach(t=>_pc.addTrack(t, ms));
      const offer = await _pc.createOffer();
      await _pc.setLocalDescription(offer);
      const model = process.env.NEXT_PUBLIC_REALTIME_MODEL || 'gpt-4o-realtime-preview';
      const sdp = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,{
        method:'POST',
        headers:{ Authorization:`Bearer ${token.client_secret}`, 'Content-Type':'application/sdp' },
        body: offer.sdp as any
      }).then(r=>r.text());
      await _pc.setRemoteDescription({ type:'answer', sdp });
      setActive(true);
    } catch(e){ console.error(e); stop(); }
    finally { setBusy(false); }
  }

  function stop(){ pc?.getSenders().forEach(s=>s.track?.stop()); pc?.close(); setPc(null); setActive(false); }

  async function askSearch(){ const q = prompt('Ask a current events question:'); if(!q) return; setBusy(true); try{ const res = await webSearch(q); setLastTool(res.text); alert(res.text); } finally{ setBusy(false); } }
  async function quickMarkets(){ setBusy(true); try{ const res = await marketSnapshot(); setLastTool(res.text); alert(res.text); } finally{ setBusy(false); } }

  useEffect(()=>()=>stop(),[]);

  return (
    <div className="card">
      <div className="row" style={{alignItems:'center', justifyContent:'space-between'}}>
        <h3 style={{margin:0}}>Interactive Voice (Premium)</h3>
        <span className={`pill ${active?'success':''}`}>{active?'Live':'Idle'}</span>
      </div>
      <div className="row" style={{marginTop:8}}>
        {!active ? (
          <button className="btn primary" onClick={start} disabled={busy}>
            {busy? <span className="spinner"/> : 'Start Voice Session'}
          </button>
        ) : (
          <button className="btn" onClick={stop}>End Session</button>
        )}
        <button className="btn" onClick={quickMarkets} disabled={busy}>Fetch Market Snapshot</button>
        <button className="btn" onClick={askSearch} disabled={busy}>Web Search Q</button>
      </div>
      <div className="small" style={{marginTop:8}}>Tip: On iOS/Safari, tap Start then unmute if playback is blocked.</div>
      <audio ref={audioRef} className="audio" autoPlay controls />
      {lastTool && <div className="small" style={{marginTop:8}}>Last fetched: {lastTool.slice(0,160)}…</div>}
    </div>
  );
}

