"use client";

import { useEffect, useRef, useState } from "react";

export default function VoiceAgent() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState("Click to start voice session");

  const startVoiceSession = async () => {
    setStatus("Connecting…");

    try {
      // Step 1: Get ephemeral key from your API
      const tokenRes = await fetch("/api/auth/ephemeral");
      const { client_secret } = await tokenRes.json();
      if (!client_secret) throw new Error("No client_secret returned");

      // Step 2: Create peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Play incoming audio
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      // Capture mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Step 3: Create data channel (optional: can be used for events/text)
      pc.createDataChannel("oai-events");

      // Step 4: Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Step 5: Send offer to OpenAI Realtime API
      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", // Or gpt-5-mini if you want to test that cost
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
        }
      );

      // Step 6: Set remote description
      const answerSDP = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSDP,
      });

      setStatus("Voice session active!");
    } catch (err) {
      console.error(err);
      setStatus("Error starting session");
    }
  };

  return (
    <div>
      <button
        onClick={startVoiceSession}
        className="rounded bg-blue-500 px-4 py-2 text-white"
      >
        Start Voice Session
      </button>
      <p>{status}</p>
    </div>
  );
}
