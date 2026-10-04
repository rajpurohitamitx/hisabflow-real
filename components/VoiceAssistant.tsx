"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Radio, Volume2, VolumeX, LoaderCircle, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string };
type Pending = { actionId: string; result: any } | null;

const LANGUAGE_CODES: Record<string, string> = {
  English: "en-IN", Hindi: "hi-IN", Tamil: "ta-IN", Telugu: "te-IN", Kannada: "kn-IN",
  Malayalam: "ml-IN", Marathi: "mr-IN", Bengali: "bn-IN", Gujarati: "gu-IN",
};

const affirmative = /^(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|confirm it|confirm this|u confirm it|you confirm it|do it|go ahead|proceed|haan|ha|ji|bilkul|theek|ठीक|हाँ|हां|जी|ஆம்|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|હા)\b/i;
const negative = /^(no|nope|cancel|stop|not this|nah|nahi|nahin|नहीं|नही|இல்லை|కాదు|ಇಲ್ಲ|ഇല്ല|ના)\b/i;

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export default function VoiceAssistant() {
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [language, setLanguage] = useState("English");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const enabledRef = useRef(false);
  const pendingRef = useRef<Pending>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => { enabledRef.current = enabled; pendingRef.current = pending; }, [enabled, pending]);

  const cleanupCapture = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    silenceTimerRef.current = null;
    maxTimerRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRef.current = null;
    setListening(false);
  }, []);

  const speak = useCallback(async (answer: string) => {
    if (!voiceEnabled || !answer.trim() || !mountedRef.current) return;
    cleanupCapture();
    setSpeaking(true);
    const lang = LANGUAGE_CODES[language] || "en-IN";
    await new Promise<void>(async (resolve) => {
      try {
        if ("speechSynthesis" in window) {
          speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(answer);
          utterance.lang = lang;
          utterance.rate = 1;
          utterance.onend = () => { setSpeaking(false); resolve(); };
          utterance.onerror = () => { setSpeaking(false); resolve(); };
          speechSynthesis.speak(utterance);
          return;
        }
        setSpeaking(false);
        resolve();
      } catch {
        setSpeaking(false);
        resolve();
      }
    });
  }, [language, voiceEnabled, cleanupCapture]);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const startCapture = useCallback(async () => {
    if (!enabledRef.current || processingRef.current || mediaRef.current || speaking) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!enabledRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];
      let heardSpeech = false;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = AudioCtx ? new AudioCtx() : null;
      audioContextRef.current = ctx;
      if (ctx) {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (mediaRef.current !== recorder) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const value of data) { const n = (value - 128) / 128; sum += n * n; }
          const rms = Math.sqrt(sum / data.length);
          if (rms > 0.018) heardSpeech = true;
          if (heardSpeech && rms < 0.012) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                if (mediaRef.current === recorder) recorder.stop();
              }, 1100);
            }
          } else if (rms >= 0.012 && silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }

      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
        silenceTimerRef.current = null;
        maxTimerRef.current = null;
        audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        if (mediaRef.current === recorder) mediaRef.current = null;
        streamRef.current = null;
        setListening(false);

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 1000 || !enabledRef.current) {
          if (enabledRef.current && !speaking) setTimeout(() => startCapture(), 250);
          return;
        }

        processingRef.current = true;
        setBusy(true);
        try {
          const form = new FormData();
          form.append("file", blob, "hi-hisab.webm");
          form.append("language", language === "Auto" ? "" : language.toLowerCase());
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Voice transcription failed.");
          const transcript = String(data.text || "").trim();
          if (!transcript) throw new Error("I could not hear that clearly. Please try again.");
          setMessages((items) => [...items, { role: "user", text: transcript }]);
          await send(transcript);
        } catch (error: any) {
          const message = error?.message || "I could not understand that. Please try again.";
          setMessages((items) => [...items, { role: "assistant", text: message }]);
          await speak(message);
        } finally {
          processingRef.current = false;
          setBusy(false);
          if (enabledRef.current && !mediaRef.current) setTimeout(() => startCapture(), 300);
        }
      };

      recorder.start(150);
      setListening(true);
      maxTimerRef.current = setTimeout(() => {
        if (mediaRef.current === recorder) recorder.stop();
      }, 12000);
    } catch (error: any) {
      setListening(false);
      setMessages((items) => [...items, { role: "assistant", text: error?.message || "Please allow microphone access for Hi Hisab." }]);
    }
  }, [language, speaking, speak]);

  const executeAction = useCallback(async (actionId: string) => {
    const response = await fetch("/api/ai/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionId, confirmed: true }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The action could not be completed.");
    return data.result;
  }, []);

  const send = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    try {
      const currentPending = pendingRef.current;
      const pendingContext = currentPending && !currentPending.result?.auto
        ? { intent: currentPending.result?.intent, entities: currentPending.result?.entities, question: currentPending.result?.response }
        : null;
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, conversationId: "hi-hisab", pendingContext }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Hisab Flow could not process that request.");
      const result = data.result;
      const answer = String(result?.response || "I understood the request.");
      setMessages((items) => [...items, { role: "assistant", text: answer }]);

      const isAffirmative = affirmative.test(text);
      const isNegative = negative.test(text);
      const needsClarification = Boolean(result?.needsClarification);
      const needsConfirmation = Boolean(result?.requiresConfirmation || result?.risk !== "LOW");
      const executableQuery = result?.risk === "LOW" && result?.intent !== "UNKNOWN" && !needsClarification && !result?.requiresConfirmation;
      const pendingAnswer = Boolean(currentPending) && (isAffirmative || isNegative);

      if (isNegative && pendingAnswer) {
        setPending(null);
        await speak(answer);
        return;
      }

      if (executableQuery || (pendingAnswer && isAffirmative && !needsClarification && result?.intent !== "UNKNOWN")) {
        try {
          const done = await executeAction(data.actionId);
          const doneMessage = String(done?.message || "Done. I updated your business records.");
          setMessages((items) => [...items, { role: "assistant", text: doneMessage }]);
          setPending(null);
          await speak(doneMessage);
          return;
        } catch (error: any) {
          setMessages((items) => [...items, { role: "assistant", text: error?.message || "I could not complete that action." }]);
          await speak(error?.message || "I could not complete that action.");
          return;
        }
      }

      if (needsClarification || needsConfirmation) setPending({ actionId: data.actionId, result });
      else setPending(null);
      await speak(answer);
    } catch (error: any) {
      const message = error?.message || "Something went wrong.";
      setMessages((items) => [...items, { role: "assistant", text: message }]);
      await speak(message);
    } finally {
      setBusy(false);
      processingRef.current = false;
      if (enabledRef.current && !mediaRef.current && !speaking) setTimeout(() => startCapture(), 350);
    }
  }, [executeAction, speak, speaking, startCapture]);

  const activate = useCallback(async () => {
    if (enabledRef.current) return;
    stopSpeaking();
    setEnabled(true);
    enabledRef.current = true;
    try { localStorage.setItem("hisabflow.voiceMode", "on"); } catch {}
    setMessages((items) => [...items, { role: "assistant", text: "Hi — Hisab is listening. Tell me anything about your business." }]);
    await startCapture();
  }, [startCapture, stopSpeaking]);

  const deactivate = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    cleanupCapture();
    stopSpeaking();
    try { localStorage.setItem("hisabflow.voiceMode", "off"); } catch {}
  }, [cleanupCapture, stopSpeaking]);

  const startWakeWord = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition || enabledRef.current || speechRef.current) return;
    try {
      const recognition = new Recognition();
      speechRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = LANGUAGE_CODES[language] || "en-IN";
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) transcript += ` ${event.results[i][0].transcript}`;
        if (/\b(?:hi|hey|hai|hello|hay)\s+(?:hisab|hisaab|hesab)(?:\s+flow)?\b/i.test(transcript)) {
          try { recognition.stop(); } catch {}
          speechRef.current = null;
          activate();
        }
      };
      recognition.onerror = () => { speechRef.current = null; };
      recognition.onend = () => {
        speechRef.current = null;
        if (!enabledRef.current) setTimeout(() => startWakeWord(), 700);
      };
      recognition.start();
    } catch { speechRef.current = null; }
  }, [activate, language]);

  useEffect(() => {
    mountedRef.current = true;
    try {
      if (localStorage.getItem("hisabflow.voiceMode") === "on") {
        // Browsers may block microphone reactivation after a full reload. We expose
        // the wake phrase/manual control instead of pretending permission exists.
        setMessages([{ role: "assistant", text: "Hi Hisab voice mode is ready. Say “Hi Hisab” or press the voice button to resume." }]);
        startWakeWord();
      } else {
        startWakeWord();
      }
    } catch { startWakeWord(); }
    return () => {
      mountedRef.current = false;
      enabledRef.current = false;
      cleanupCapture();
      try { speechRef.current?.stop(); } catch {}
      speechRef.current = null;
      stopSpeaking();
    };
  }, [cleanupCapture, startWakeWord, stopSpeaking]);

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[min(390px,calc(100vw-24px))]">
      <div className={`overflow-hidden rounded-[24px] border bg-white shadow-[0_24px_80px_rgba(10,30,23,.20)] ${enabled ? "border-[#8fd4b7]" : "border-[#dfe8e3]"}`}>
        <div className="flex items-center justify-between gap-3 bg-[#0b1813] px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${listening ? "bg-[#70d8ad] text-[#06291c]" : enabled ? "bg-[#1f4939] text-[#9fe3c5]" : "bg-white/10 text-white"}`}>
              {listening ? <Mic size={18} /> : <Radio size={18} />}
            </div>
            <div className="min-w-0">
              <div className="font-black">Hi Hisab</div>
              <div className="truncate text-[11px] text-white/55">{listening ? "Listening…" : speaking ? "Speaking…" : enabled ? "Voice mode is on" : "Say “Hi Hisab” anytime"}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setVoiceEnabled((v) => !v)} title="Toggle spoken replies" className="rounded-full p-2 text-white/65 hover:bg-white/10 hover:text-white">{voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
            {enabled && <button onClick={deactivate} title="Turn off Hi Hisab" className="rounded-full p-2 text-white/65 hover:bg-white/10 hover:text-white"><X size={16} /></button>}
          </div>
        </div>
        {enabled && (
          <>
            <div className="max-h-44 space-y-2 overflow-y-auto bg-[#f7faf8] p-3">
              {messages.slice(-5).map((message, index) => <div key={index} className={`rounded-2xl px-3 py-2 text-xs leading-5 ${message.role === "user" ? "ml-8 bg-[#0c6b4d] text-white" : "mr-5 border border-[#e2e9e5] bg-white text-[#33433b]"}`}>{message.text}</div>)}
              {busy && <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-[#78877f]"><LoaderCircle size={13} className="animate-spin" /> Understanding…</div>}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#e5ebe7] px-3 py-2">
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-full bg-[#f1f6f3] px-2 py-1 text-[11px] font-semibold text-[#506158] outline-none">
                {Object.keys(LANGUAGE_CODES).map((item) => <option key={item}>{item}</option>)}
              </select>
              <button onClick={listening ? cleanupCapture : () => startCapture()} disabled={busy && !listening} className="flex items-center gap-2 rounded-full bg-[#0c6b4d] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                {listening ? <MicOff size={14} /> : <Mic size={14} />} {listening ? "Stop listening" : "Listen"}
              </button>
              {speaking && <button onClick={stopSpeaking} className="rounded-full bg-[#f0f3f1] px-3 py-2 text-xs font-bold text-[#52625a]">Stop voice</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
