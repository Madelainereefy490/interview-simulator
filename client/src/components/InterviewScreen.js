import React, { useState, useEffect, useRef, useCallback } from "react";
import { Btn, Card, Label, Bar } from "./UI";
import { useVoice } from "./useVoice";
import { useCamera } from "./useCamera";
import { useCheat } from "./useCheat";
import { callClaude, parseJSON, fmt } from "../api";

const PHASES = [
  { id: "intro", label: "Introduction", icon: "👋" },
  { id: "resume_deep", label: "Resume Deep-Dive", icon: "📄" },
  { id: "technical", label: "Technical Round", icon: "⚙️" },
  { id: "behavioral", label: "Behavioral", icon: "🧠" },
  { id: "situational", label: "Situational", icon: "🎯" },
  { id: "closing", label: "Closing", icon: "🤝" },
];

function trySpeak(text) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) || voices.find((v) => v.lang.startsWith("en"));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

function AudioWave({ level, isRecording }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 30, gap: 2 }}>
      {[...Array(12)].map((_, i) => {
        const h = isRecording ? Math.max(4, (level / 100) * 24 * (0.5 + Math.random() * 0.5)) : 4;
        return <div key={i} style={{ width: 4, height: h, background: isRecording ? "var(--r)" : "var(--bd2)", borderRadius: 2, transition: "height .1s ease" }} />;
      })}
    </div>
  );
}

export default function InterviewScreen({ config, onComplete }) {
  const [phase, setPhase] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [curQ, setCurQ] = useState("");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [qTimer, setQTimer] = useState(0);
  const [followUps, setFollowUps] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [permStatus, setPermStatus] = useState("checking");
  const [statusMsg, setStatusMsg] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const voice = useVoice();
  const cam = useCamera();
  const cheat = useCheat();
  const timerRef = useRef(null);
  const qTimerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    async function init() {
      setPermStatus("checking");
      const micOk = await voice.requestPermission();
      await cam.startCamera();
      if (!micOk) { setPermStatus("denied"); return; }
      setPermStatus("granted");
      await genQuestions();
    }
    init();
    return () => { clearInterval(timerRef.current); clearInterval(qTimerRef.current); cam.stopCamera(); };
  }, []);

  const resetQTimer = useCallback(() => {
    clearInterval(qTimerRef.current);
    setQTimer(0);
    qTimerRef.current = setInterval(() => setQTimer((p) => p + 1), 1000);
  }, []);

  useEffect(() => { if (!loading) resetQTimer(); return () => clearInterval(qTimerRef.current); }, [qIdx, loading]);

  async function genQuestions() {
    setLoading(true);
    const iCtx = config.interviewerProfiles?.length > 0
      ? `\n\nInterviewer Profiles:\n${config.interviewerProfiles.map((p) => `- ${p.name} (${p.likelyRole}): Focus: ${p.expectedFocusAreas?.join(", ")}. Style: ${p.likelyQuestionStyle}. Level: ${p.difficultyLevel}`).join("\n")}\nMatch each question to the interviewer whose background fits best.`
      : "";
    const rCtx = config.resumeText
      ? `\n\nCandidate's Resume:\n${config.resumeText.substring(0, 4000)}${config.resumeParsed ? `\nWeaknesses to probe: ${JSON.stringify(config.resumeParsed.weaknesses || [])}\nGaps: ${JSON.stringify(config.resumeParsed.gaps || [])}` : ""}`
      : "";

    const sys = `You are real human interviewers — a Technical Lead with ${config.experienceLevel === "10+" ? "15+" : "12+"} years hands-on experience, an HR Director, and a VP/CEO. You have personally built and managed production systems, debugged live outages, scaled teams, and shipped products.

CRITICAL RULES for writing questions:
- Write like a REAL person talks in an interview, not like an AI or textbook
- Use casual professional language: "So tell me about...", "Walk me through...", "I noticed on your resume...", "What happened when...", "How did you handle..."
- Reference SPECIFIC technologies from the JD — don't use generic terms
- Ask about REAL situations: "Have you ever had a deployment go sideways?", "What's the worst outage you dealt with?"
- For technical questions, ask about real debugging scenarios, architecture decisions, tradeoffs — not textbook definitions
- NEVER use phrases like "Can you describe...", "Please elaborate on...", "Could you explain..." — these sound robotic
- Each interviewer should have a distinct personality:
  * Technical Lead: Blunt, direct, digs deep into implementation details, asks "why did you choose X over Y?"
  * HR Director: Warm but probing, focuses on conflict, growth, teamwork stories
  * CEO/VP: Big-picture thinker, asks about impact, ownership, what you'd change
- For resume probes: directly reference specific companies, projects, durations from the resume. Say things like "I see you were at [Company] for [duration] — tell me about..."${iCtx}

Generate as ONLY valid JSON (no markdown):
{"questions":[{"phase":"intro|resume_deep|technical|behavioral|situational|closing","question":"...","interviewer":"${config.interviewerProfiles?.length > 0 ? "use actual interviewer name" : "Technical Lead|HR Director|CEO"}","expectedTopics":[],"difficulty":1,"resumeRelated":false}]}

Phases: intro(1-2 warm-up), resume_deep(${config.resumeText ? "3-4 drilling into resume specifics" : "0"}), technical(4-6 deep hands-on questions), behavioral(3-4 STAR stories), situational(2-3 real scenarios), closing(1-2).
Difficulty level: ${config.difficulty} for ${config.experienceLevel} years experience.`;

    const result = await callClaude(sys, `Job Description:\n${config.jd}${rCtx}`, 4096);
    const parsed = parseJSON(result);
    const qs = parsed?.questions?.filter(q => q.question && q.question.length > 10) || getFallbackQuestions();
    setQuestions(qs);
    setCurQ(qs[0]?.question || "");
    setLoading(false);
    cheat.startQ();
    setTimeout(() => trySpeak(qs[0]?.question || ""), 500);
  }

  function getFallbackQuestions() {
    return [
      { phase: "intro", question: "Hey, thanks for coming in. Before we dive into the technical stuff, walk me through your journey — what have you been working on recently and what made you apply here?", interviewer: "HR Director", expectedTopics: ["recent work", "motivation"], difficulty: 3, resumeRelated: false },
      { phase: "technical", question: "Alright, let's get into it. Tell me about the gnarliest production issue you've dealt with — what broke, how did you figure out the root cause, and what did you do to make sure it didn't happen again?", interviewer: "Technical Lead", expectedTopics: ["incident response", "debugging", "prevention"], difficulty: 7, resumeRelated: true },
      { phase: "technical", question: "So if I gave you a system that's handling 10x more traffic than expected and response times are spiking — where do you start? Walk me through your thought process.", interviewer: "Technical Lead", expectedTopics: ["monitoring", "bottlenecks", "scaling"], difficulty: 8, resumeRelated: false },
      { phase: "behavioral", question: "Tell me about a time things got heated with a teammate or a stakeholder — maybe you disagreed on an approach or priorities. How did that play out?", interviewer: "HR Director", expectedTopics: ["conflict", "communication", "resolution"], difficulty: 6, resumeRelated: false },
      { phase: "situational", question: "It's 2 AM, PagerDuty goes off, your main service is down and customers are complaining on Twitter. You're the on-call. Go — what do you do in the first 15 minutes?", interviewer: "Technical Lead", expectedTopics: ["triage", "communication", "rollback"], difficulty: 8, resumeRelated: false },
      { phase: "closing", question: "Last thing — if you join us and look back a year from now, what would make you say 'yeah, this was the right move'? And what questions do you have for us?", interviewer: "CEO", expectedTopics: ["goals", "culture fit", "curiosity"], difficulty: 3, resumeRelated: false },
    ];
  }

  function endInterviewEarly() {
    if (voice.isRecording) voice.stopRecording();
    clearInterval(timerRef.current);
    clearInterval(qTimerRef.current);
    cam.stopCamera();
    trySpeak("Alright, we'll wrap up here. Let me put together your evaluation.");
    setStatusMsg("Ending interview and preparing evaluation...");
    setTimeout(() => onComplete({ answers, metrics: cheat.m, elapsed, config }), 2000);
  }

  async function handleStopAndSubmit() {
    if (submitting) return;
    if (voice.isRecording) voice.stopRecording();
    await new Promise((r) => setTimeout(r, 800));
    const finalTranscript = voice.transcript.trim();
    if (!finalTranscript) { setStatusMsg("No speech detected. Please record your answer first."); return; }
    setSubmitting(true);
    setStatusMsg("Evaluating your answer...");
    cheat.recordA(finalTranscript, qTimer);
    const cq = questions[qIdx];
    const vm = voice.voiceMetrics;
    const resumeRef = config.resumeText ? `\nResume:\n${config.resumeText.substring(0, 2000)}` : "";

    const raw = await callClaude(
      `You are an expert interview evaluator. Evaluate this SPOKEN answer. ONLY valid JSON:
{"score":0,"contentAnalysis":{"technicalAccuracy":0,"depthScore":0,"relevanceScore":0,"resumeConsistency":0},"deliveryAnalysis":{"overallDelivery":0,"confidenceScore":0,"readingVsSpeaking":"reading|natural|mixed","fillerWordRating":"excessive|moderate|minimal","pacingRating":"too_fast|good|too_slow","authenticityScore":0},"cheating":{"appearsRead":false,"tooGeneric":false,"contradicts_resume":false,"confidence":0,"reasoning":""},"feedback":"","deliveryFeedback":"","followUp":null,"keyMissing":[],"keyStrengths":[]}
Reading detection: appearsRead=true if overly formal/scripted, no hesitation, exact documentation phrasing. Natural speech has contractions, self-corrections, organic flow.`,
      `Q: ${cq?.question}\nExpected: ${JSON.stringify(cq?.expectedTopics)}\nAnswer (spoken): ${finalTranscript}\nVoice: Words=${vm.totalWords} WPM=${vm.wordsPerMinute} Fillers=${vm.fillerWords} Time=${qTimer}s Tabs=${cheat.m.tabSwitches}${resumeRef}`,
      1536
    );
    const evaluation = parseJSON(raw) || { score: 5, feedback: "Evaluated", deliveryAnalysis: {}, contentAnalysis: {}, cheating: {} };
    const snapshot = cam.getSnapshot();
    const newAns = { question: cq?.question || curQ, answer: finalTranscript, phase: cq?.phase, interviewer: cq?.interviewer || "Panel", evaluation, voiceMetrics: { ...vm }, responseTime: qTimer, snapshot, timestamp: new Date().toISOString() };
    const allAns = [...answers, newAns];
    setAnswers(allAns);

    if (evaluation.followUp && followUps < 2) {
      setFollowUps((p) => p + 1); setCurQ(evaluation.followUp); voice.resetTranscript(); setStatusMsg(""); cheat.startQ(); trySpeak(evaluation.followUp); setSubmitting(false); return;
    }
    setFollowUps(0);
    const next = qIdx + 1;
    if (next < questions.length) {
      setQIdx(next); setCurQ(questions[next].question);
      const pi = PHASES.findIndex((p) => p.id === questions[next].phase);
      if (pi >= 0) setPhase(pi);
      voice.resetTranscript(); setStatusMsg(""); cheat.startQ(); trySpeak(questions[next].question);
    } else {
      clearInterval(timerRef.current); clearInterval(qTimerRef.current);
      trySpeak("That's all from us. Thanks for your time — we'll have your evaluation ready shortly.");
      setStatusMsg("Finishing up...");
      setTimeout(() => onComplete({ answers: allAns, metrics: cheat.m, elapsed, config }), 2000);
    }
    setSubmitting(false);
  }

  function skipQuestion() {
    const cq = questions[qIdx];
    if (voice.isRecording) voice.stopRecording();
    voice.resetTranscript();
    const allAns = [...answers, { question: cq?.question || curQ, answer: "[SKIPPED]", phase: cq?.phase, interviewer: cq?.interviewer, evaluation: { score: 0, feedback: "Skipped", deliveryAnalysis: {}, contentAnalysis: {} }, voiceMetrics: {}, responseTime: 0, timestamp: new Date().toISOString() }];
    setAnswers(allAns);
    setFollowUps(0);
    const next = qIdx + 1;
    if (next < questions.length) {
      setQIdx(next); setCurQ(questions[next].question);
      const pi = PHASES.findIndex((p) => p.id === questions[next].phase);
      if (pi >= 0) setPhase(pi);
      cheat.startQ(); trySpeak(questions[next].question);
    } else { clearInterval(timerRef.current); onComplete({ answers: allAns, metrics: cheat.m, elapsed, config }); }
  }

  if (permStatus === "denied") return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--r)", fontFamily: "var(--fm)", marginBottom: 12 }}>Microphone Access Required</h2>
        <p style={{ color: "var(--td)", lineHeight: 1.6, marginBottom: 24 }}>Allow microphone access in Chrome: click the 🔒 lock icon in address bar → Microphone → Allow</p>
        <Btn primary onClick={() => window.location.reload()}>Refresh & Try Again</Btn>
      </div>
    </div>
  );

  if (permStatus === "checking" || loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, border: "3px solid var(--bd)", borderTopColor: "var(--a)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
        <div style={{ color: "var(--a)", fontSize: 14, fontFamily: "var(--fm)", fontWeight: 600 }}>
          {permStatus === "checking" ? "Requesting mic & camera access..." : "Preparing interview questions..."}
        </div>
      </div>
    </div>
  );

  const cq = questions[qIdx];
  const progress = questions.length > 0 ? ((qIdx + 1) / questions.length) * 100 : 0;
  const ic = cheat.m.integrity > 70 ? "var(--g)" : cheat.m.integrity > 40 ? "var(--w)" : "var(--r)";
  const iColor = cq?.interviewer?.includes("CEO") || cq?.interviewer?.includes("VP") ? "var(--p)" : cq?.interviewer?.includes("HR") ? "#22d3ee" : "var(--a)";
  const iIcon = cq?.interviewer?.includes("CEO") || cq?.interviewer?.includes("VP") ? "🏢" : cq?.interviewer?.includes("HR") ? "👥" : "⚙️";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* End Interview Modal */}
      {showEndConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Card style={{ maxWidth: 420, textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏹</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--t)", marginBottom: 12, fontFamily: "var(--fm)" }}>End Interview?</h3>
            <p style={{ color: "var(--td)", fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
              You've answered <strong style={{ color: "var(--a)" }}>{answers.length}</strong> of <strong style={{ color: "var(--a)" }}>{questions.length}</strong> questions.
            </p>
            <p style={{ color: "var(--tm)", fontSize: 12, marginBottom: 24 }}>
              Unanswered questions will be marked as skipped. Evaluation will be based on answers given so far.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Btn onClick={() => setShowEndConfirm(false)}>Continue Interview</Btn>
              <Btn danger onClick={() => { setShowEndConfirm(false); endInterviewEarly(); }}>End & Get Results</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "var(--s)", borderBottom: "1px solid var(--bd)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>{PHASES[phase]?.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--a)", fontFamily: "var(--fm)" }}>{PHASES[phase]?.label}</div>
            <div style={{ fontSize: 10, color: "var(--tm)" }}>Q{qIdx + 1}/{questions.length} · {cq?.interviewer}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {voice.isRecording && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--r)", animation: "pulse 1.5s ease-in-out infinite" }} />
              <span style={{ fontSize: 11, color: "var(--r)", fontFamily: "var(--fm)", fontWeight: 600 }}>REC</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 16, border: `1px solid ${ic}33` }}>
            <span style={{ fontSize: 10 }}>🛡️</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: ic, fontFamily: "var(--fm)" }}>{cheat.m.integrity}%</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--a)", fontFamily: "var(--fm)", fontVariantNumeric: "tabular-nums" }}>{fmt(elapsed)}</div>
          <Btn danger small onClick={() => setShowEndConfirm(true)} disabled={submitting || answers.length === 0} style={{ marginLeft: 4 }}>⏹ End Interview</Btn>
        </div>
      </div>
      <div style={{ height: 3, background: "var(--s2)" }}><div style={{ height: "100%", width: `${progress}%`, background: "var(--a)", transition: "width .5s" }} /></div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, padding: 20, maxWidth: 1200, margin: "0 auto" }}>
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, fontSize: 20, background: `${iColor}22`, border: `2px solid ${iColor}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>{iIcon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--fm)", color: "var(--tm)", marginBottom: 6 }}>
                  {cq?.interviewer}
                  {cq?.resumeRelated && <span style={{ color: "var(--a)", marginLeft: 8 }}>📄 Resume Probe</span>}
                  {cq?.difficulty >= 8 && <span style={{ color: "var(--r)", marginLeft: 8 }}>🔥 Hard</span>}
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.7, color: "var(--t)" }}>{curQ}</div>
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Label>🎤 Your Answer</Label>
              <span style={{ fontSize: 11, color: "var(--tm)", fontFamily: "var(--fm)", fontVariantNumeric: "tabular-nums" }}>⏱ {fmt(qTimer)}</span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <button onClick={voice.isRecording ? () => {} : voice.startRecording} disabled={submitting} className={voice.isRecording ? "recording-ring" : ""}
                style={{ width: 64, height: 64, borderRadius: "50%", border: "none", cursor: submitting ? "not-allowed" : "pointer", background: voice.isRecording ? "var(--r)" : "linear-gradient(135deg, var(--a), #3b82f6)", color: "#fff", fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {voice.isRecording ? "⏺" : "🎤"}
              </button>
              <div style={{ flex: 1 }}>
                <AudioWave level={voice.audioLevel} isRecording={voice.isRecording} />
                <div style={{ fontSize: 12, color: voice.isRecording ? "var(--r)" : "var(--tm)", marginTop: 4 }}>
                  {voice.isRecording ? `● Recording — ${voice.voiceMetrics.totalWords || 0} words` : voice.transcript ? `✓ ${voice.voiceMetrics.totalWords || 0} words recorded` : "Click 🎤 to start speaking your answer"}
                </div>
              </div>
            </div>
            {(voice.transcript || voice.interimText) && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--tm)", fontFamily: "var(--fm)" }}>TRANSCRIPT</span>
                  <button onClick={() => setShowTranscript((p) => !p)} style={{ fontSize: 10, color: "var(--a)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--fm)" }}>{showTranscript ? "HIDE" : "SHOW"}</button>
                </div>
                {showTranscript && (
                  <div style={{ padding: 12, background: "var(--s2)", borderRadius: 8, fontSize: 13, lineHeight: 1.7, color: "var(--t)", minHeight: 60, maxHeight: 200, overflow: "auto", border: "1px solid var(--bd)" }}>
                    {voice.transcript}
                    {voice.interimText && <span style={{ color: "var(--a)", opacity: 0.6 }}>{voice.interimText}</span>}
                  </div>
                )}
              </div>
            )}
            {statusMsg && <div style={{ marginTop: 10, padding: 10, background: "rgba(88,166,255,.06)", borderRadius: 6, fontSize: 12, color: "var(--a)", fontFamily: "var(--fm)" }}>{statusMsg}</div>}
            {voice.error && <div style={{ marginTop: 10, padding: 10, background: "rgba(248,81,73,.06)", borderRadius: 6, fontSize: 12, color: "var(--r)" }}>⚠ {voice.error}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
              {voice.isRecording
                ? <Btn primary style={{ flex: 1 }} onClick={handleStopAndSubmit} disabled={submitting}>⏹ Stop & Submit Answer</Btn>
                : <Btn primary style={{ flex: 1 }} onClick={handleStopAndSubmit} disabled={!voice.transcript.trim() || submitting}>{submitting ? "⏳ Evaluating..." : "Submit Answer →"}</Btn>
              }
              <Btn danger small onClick={skipQuestion} disabled={submitting}>Skip</Btn>
            </div>
          </Card>
        </div>

        <div>
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--bd)", marginBottom: 14, position: "relative", background: "#000", aspectRatio: "4/3" }}>
            <video ref={cam.videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
            {!cam.isActive && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--s2)", flexDirection: "column", gap: 8 }}><span style={{ fontSize: 24 }}>📷</span><span style={{ fontSize: 11, color: "var(--tm)" }}>Camera not available</span></div>}
            {cam.isActive && <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,.7)", borderRadius: 12, padding: "3px 10px" }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--r)", animation: "pulse 1.5s ease-in-out infinite" }} /><span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>LIVE</span></div>}
          </div>
          <Card style={{ padding: 14, marginBottom: 12, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto 8px", fontSize: 24, background: `${iColor}22`, border: `2px solid ${iColor}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>{iIcon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: iColor }}>{cq?.interviewer}</div>
            <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2 }}>{PHASES[phase]?.label}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 8 }}>{[...Array(10)].map((_, i) => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i < (cq?.difficulty || 5) ? iColor : "var(--s2)" }} />)}</div>
            <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 4 }}>Difficulty {cq?.difficulty || "?"}/10</div>
          </Card>
          <Card style={{ padding: 12, marginBottom: 12 }}>
            <Label>Progress</Label>
            {PHASES.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", opacity: i < phase ? 0.4 : 1 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", background: i === phase ? "rgba(88,166,255,.12)" : i < phase ? "rgba(63,185,80,.12)" : "var(--s2)", border: `1px solid ${i === phase ? "var(--a)" : i < phase ? "var(--g)" : "var(--bd)"}`, color: i < phase ? "var(--g)" : i === phase ? "var(--a)" : "var(--tm)" }}>{i < phase ? "✓" : p.icon}</div>
                <span style={{ fontSize: 11, color: i === phase ? "var(--a)" : "var(--tm)", fontWeight: i === phase ? 600 : 400 }}>{p.label}</span>
                {i === phase && <span style={{ fontSize: 9, color: "var(--tm)", marginLeft: "auto" }}>Q{qIdx + 1}</span>}
              </div>
            ))}
          </Card>
          <Card style={{ padding: 12, borderColor: cheat.m.integrity < 70 ? "rgba(248,81,73,.2)" : "var(--bd)" }}>
            <Label color={ic}>🛡️ Integrity</Label>
            <Bar value={cheat.m.integrity} color={ic} h={5} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
              {[["Tabs", cheat.m.tabSwitches, cheat.m.tabSwitches > 0], ["Flags", cheat.m.patterns.length, cheat.m.patterns.length > 3], ["Paste", cheat.m.copyPastes, cheat.m.copyPastes > 0], ["Done", answers.length, false]].map(([l, v, bad]) => (
                <div key={l} style={{ textAlign: "center", padding: 5, background: "var(--s2)", borderRadius: 5 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: bad ? "var(--r)" : "var(--g)", fontFamily: "var(--fm)" }}>{v}</div>
                  <div style={{ fontSize: 9, color: "var(--tm)" }}>{l}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
