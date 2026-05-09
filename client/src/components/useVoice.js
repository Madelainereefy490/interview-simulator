import { useState, useRef, useCallback, useEffect } from "react";

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState("");
  const [voiceMetrics, setVoiceMetrics] = useState({
    fillerWords: 0, wordsPerMinute: 0, totalWords: 0, confidence: 0,
  });

  const recognitionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const wordCountRef = useRef(0);
  const shouldRestartRef = useRef(false);
  const fillerRegex = /\b(um|uh|er|ah|like|you know|basically|literally|so|right|okay|actually|kind of|sort of)\b/gi;

  const requestPermission = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      s.getTracks().forEach((t) => t.stop());
      setHasPermission(true); setError(""); return true;
    } catch (e) {
      setHasPermission(false);
      setError("Microphone permission denied. Click the 🔒 lock icon in address bar → Microphone → Allow");
      return false;
    }
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Use Chrome or Edge for voice support."); return; }
    try {
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = "en-US"; r.maxAlternatives = 3;
      r.onresult = (e) => {
        let f = "", i = "", conf = 0, cc = 0;
        for (let x = 0; x < e.results.length; x++) {
          if (e.results[x].isFinal) {
            f += e.results[x][0].transcript + " ";
            conf += e.results[x][0].confidence; cc++;
            wordCountRef.current += e.results[x][0].transcript.trim().split(/\s+/).length;
          } else { i += e.results[x][0].transcript; }
        }
        if (f) {
          setTranscript((p) => p + f);
          setVoiceMetrics((prev) => ({
            ...prev,
            confidence: cc > 0 ? Math.round((conf / cc) * 100) : prev.confidence,
            totalWords: wordCountRef.current,
          }));
        }
        setInterimText(i);
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed") {
          setHasPermission(false);
          setError("Microphone denied. Allow it in browser settings.");
          setIsRecording(false); shouldRestartRef.current = false;
        }
      };
      r.onend = () => { if (shouldRestartRef.current) try { r.start(); } catch (e) {} };
      recognitionRef.current = r;
    } catch (e) { setError("Speech recognition unavailable."); }
    return () => { shouldRestartRef.current = false; try { recognitionRef.current?.stop(); } catch (e) {} };
  }, []);

  const startRecording = useCallback(async () => {
    setTranscript(""); setInterimText(""); setError("");
    wordCountRef.current = 0; startTimeRef.current = Date.now();
    setVoiceMetrics({ fillerWords: 0, wordsPerMinute: 0, totalWords: 0, confidence: 0 });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream; setHasPermission(true);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(100, avg * 2));
        animFrameRef.current = requestAnimationFrame(update);
      };
      update();
      shouldRestartRef.current = true;
      try { recognitionRef.current?.start(); } catch (e) {}
      setIsRecording(true);
    } catch (e) { setHasPermission(false); setError("Cannot access microphone: " + e.message); }
  }, []);

  const stopRecording = useCallback(() => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch (e) {}
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch (e) {}
    setIsRecording(false); setAudioLevel(0); setInterimText("");
    const totalSec = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 1;
    setTranscript((ft) => {
      const fillers = (ft.match(fillerRegex) || []).length;
      const wpm = totalSec > 0 ? Math.round((wordCountRef.current / totalSec) * 60) : 0;
      setVoiceMetrics({ fillerWords: fillers, wordsPerMinute: wpm, totalWords: wordCountRef.current, confidence: 0 });
      return ft;
    });
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript(""); setInterimText(""); wordCountRef.current = 0;
  }, []);

  return { isRecording, transcript, interimText, audioLevel, hasPermission, error, voiceMetrics, startRecording, stopRecording, resetTranscript, requestPermission };
}
