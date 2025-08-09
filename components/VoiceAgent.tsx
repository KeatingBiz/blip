"use client";

import { useEffect, useRef, useState } from "react";

const COST_PER_MIN_REALTIME = 0.006; // tweak to your latest rate ($/min)

export default function VoiceAgent() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "stopped" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [estCost, setEstCost] = useState(0);

  async function start() {
    setError(null);
    setStatus("connecting");
    setSeconds(0);
    setEstCost(0);

    try {
      // 1) Get ephemeral token+URL from your API
      const r = await fetch("/api/auth/ephemeral");
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to get ephemeral token");

      const token = data.token || data.client_secret;
      const url = data.url; // e.g. https://api.openai.com/v1/realtime?model=...

      // 2) Get microphone
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;

      // 3) Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 4) Remote audio -> play in hidden audio tag
      const remote = new MediaStream();
      pc.ontrack = (e) => {
        remote.addTrack(e.track);
      };
      if (!remoteAudioRef.current) {
        const el = document.createElement("audio");
        el.autoplay = true;
        el.playsInline = true;
        el.className = "hidden";
        document.body.appendChild(el);
        remoteAudioRef.current = el;
      }
      remoteAudioRef.current.srcObject = remote;

      // 5) Send mic tracks
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // 6) (Optional) data channel
      pc.createDataChannel("oai-events");

      // 7) Offer/Answer (SDP) with OpenAI Realtime
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp as any,
      });
      if (!sdpResp.ok) throw new Error(`Realtime SDP failed: ${sdpResp.status}`);

      const answer = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      // 8) We’re live
      setStatus("live");
      startedAtRef.current = Date.now();
      tickRef.current = window.setInterval(() => {
        if (!startedAtRef.current) return;
        const elapsedMs = Date.now() - startedAtRef.current;
        const s = Math.floor(elapsedMs / 1000);
        setSeconds(s);
        setEstCost((elapsedMs / 60000) * COST_PER_MIN_REALTIME);
      }, 500);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to start session");
      setStatus("error");
      await stop(); // ensure cleanup
    }
  }

  async function stop() {
    // Stop ticker
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    // Close peer connection
    if (pcRef.current) {
      try {
        pcRef.current.getSenders().forEach((s) => s.track && s.track.stop());
      } catch {}
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    // Stop mic
    if (micRef.current) {
      try {
        micRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      micRef.current = null;
    }
    setStatus((prev) => (prev === "error" ? "error" : "stopped"));
  }

  useEffect(() => {
    return () => {
      // cleanup on unmount
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canStart = status === "idle" || status === "stopped" || status === "error";
  const canStop = status === "live" || status === "connecting";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <div>
            Status:{" "}
            <span className={status === "live" ? "text-emerald-600" : "text-gray-800"}>
              {status}
            </span>
          </div>
          <div>Elapsed: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>
          <div>
            Est. cost: ${estCost.toFixed(4)} @ ${COST_PER_MIN_REALTIME.toFixed(3)}/min
          </div>
          {error && <div className="mt-1 text-red-600">Error: {error}</div>}
        </div>

        <div className="flex gap-2">
          <button
            onClick={start}
            disabled={!canStart}
            className={[
              "rounded-xl px-3 py-2 text-sm font-medium text-white",
              canStart ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-300",
            ].join(" ")}
          >
            Start voice session
          </button>
          <button
            onClick={stop}
            disabled={!canStop}
            className="rounded-xl bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}

