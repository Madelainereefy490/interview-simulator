import React, { useState, useEffect } from "react";
import { Card, Label, Bar, Btn, Spinner } from "./UI";
import { callClaude, parseJSON, fmt } from "../api";

const SCORE_META = {
  technicalAccuracy: { label: "Technical Accuracy", icon: "⚙️" },
  communicationSkills: { label: "Communication", icon: "💬" },
  problemSolving: { label: "Problem Solving", icon: "🧩" },
  relevantExperience: { label: "Experience Depth", icon: "📊" },
  resumeConsistency: { label: "Resume Consistency", icon: "📋" },
  deliveryScore: { label: "Delivery Quality", icon: "🎤" },
  culturalFit: { label: "Cultural Fit", icon: "🤝" },
  integrity: { label: "Interview Integrity", icon: "🛡️" },
};

function scoreColor(v) {
  return v >= 80 ? "var(--g)" : v >= 60 ? "var(--w)" : "var(--r)";
}

export default function ResultsScreen({ data }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => { genReport(); }, []);

  async function genReport() {
    // Aggregate voice metrics across all answers
    const allVoiceMetrics = data.answers.filter((a) => a.voiceMetrics?.totalWords > 0);
    const avgWpm = allVoiceMetrics.length > 0
      ? Math.round(allVoiceMetrics.reduce((s, a) => s + (a.voiceMetrics?.wordsPerMinute || 0), 0) / allVoiceMetrics.length)
      : 0;
    const totalFillers = allVoiceMetrics.reduce((s, a) => s + (a.voiceMetrics?.fillerWords || 0), 0);
    const avgSpeakingRatio = allVoiceMetrics.length > 0
      ? Math.round(allVoiceMetrics.reduce((s, a) => s + (a.voiceMetrics?.speakingRatio || 0), 0) / allVoiceMetrics.length)
      : 0;

    const raw = await callClaude(
      `You are a hiring panel (Technical Lead, HR Director, CEO) + a communication coach. Generate a full evaluation including voice delivery analysis. ONLY valid JSON:\n{
  "overallScore": 0,
  "verdict": "STRONG HIRE|HIRE|CONDITIONAL|NOT SELECTED",
  "verdictReason": "",
  "scores": {
    "technicalAccuracy": 0, "communicationSkills": 0, "problemSolving": 0,
    "relevantExperience": 0, "resumeConsistency": 0, "deliveryScore": 0,
    "culturalFit": 0, "integrity": 0
  },
  "panel": {
    "technicalLead": { "vote": "hire|no_hire|conditional", "strengths": [], "concerns": [], "comment": "" },
    "hrDirector": { "vote": "hire|no_hire|conditional", "strengths": [], "concerns": [], "comment": "" },
    "ceo": { "vote": "hire|no_hire|conditional", "strengths": [], "concerns": [], "comment": "" }
  },
  "deliveryReport": {
    "overallDelivery": 0,
    "readingVsSpeaking": "reading|natural|mixed",
    "confidence": 0,
    "clarity": 0,
    "pacing": "too_fast|good|too_slow",
    "fillerUsage": "excessive|moderate|minimal",
    "authenticityScore": 0,
    "deliveryStrengths": [],
    "deliveryImprovements": [],
    "coachingTips": []
  },
  "cheating": {
    "risk": "low|medium|high|critical",
    "findings": [],
    "resumeDiscrepancies": [],
    "recommendation": ""
  },
  "questionScores": [{ "q": "", "score": 0, "contentFeedback": "", "deliveryFeedback": "", "interviewer": "" }],
  "strengths": [],
  "improvements": [],
  "advice": [],
  "resumeFit": { "score": 0, "matchedSkills": [], "missingSkills": [], "overclaimedAreas": [] }
}

Voice delivery scoring rules:
- readingVsSpeaking: if across multiple answers the language is consistently formal/scripted = "reading"
- Consider WPM: 130-160 is ideal conversational pace
- High filler count AND scripted language = suspicious (reading and inserting fillers to mask it)
- Low filler count + natural variation = genuine spontaneous speech
- integrity < 50 if tabs > 3 or critical flags exist`,
      `Candidate: ${data.config.candidateName} | ${data.config.experienceLevel}y | ${data.config.difficulty} | Duration: ${fmt(data.elapsed)}

Anti-Cheat: Tabs=${data.metrics.tabSwitches} Flags=${data.metrics.patterns.length} Paste=${data.metrics.copyPastes} Integrity=${data.metrics.integrity}%
Flags: ${JSON.stringify(data.metrics.patterns.slice(0, 15))}

Voice Aggregates: Avg WPM=${avgWpm} Total Fillers=${totalFillers} Avg Speaking Ratio=${avgSpeakingRatio}%

Resume: ${data.config.resumeText ? data.config.resumeText.substring(0, 2000) : "Not provided"}

Q&A with voice metrics:
${data.answers.map((a, i) => `[${a.interviewer}] Q${i + 1} (${a.phase}): ${a.question}
Answer: ${a.answer.substring(0, 500)}
Time: ${a.responseTime}s | Words: ${a.voiceMetrics?.totalWords || 0} | WPM: ${a.voiceMetrics?.wordsPerMinute || 0} | Fillers: ${a.voiceMetrics?.fillerWords || 0}
Content score: ${a.evaluation?.score} | Delivery eval: ${JSON.stringify(a.evaluation?.deliveryAnalysis || {})} | Cheating flags: ${JSON.stringify(a.evaluation?.cheating || {})}`).join("\n\n")}

JD: ${data.config.jd.substring(0, 1200)}`,
      4096
    );

    const parsed = parseJSON(raw);
    if (parsed) { setReport(parsed); }
    else {
      const avg = data.answers.reduce((s, a) => s + (a.evaluation?.score || 0), 0) / Math.max(data.answers.length, 1);
      setReport({
        overallScore: Math.round(avg * 10),
        verdict: avg >= 7 ? "HIRE" : avg >= 5 ? "CONDITIONAL" : "NOT SELECTED",
        verdictReason: "Based on available evaluation data",
        scores: { technicalAccuracy: Math.round(avg * 10), communicationSkills: 60, problemSolving: Math.round(avg * 10), relevantExperience: Math.round(avg * 10), resumeConsistency: 50, deliveryScore: 60, culturalFit: 60, integrity: data.metrics.integrity },
        panel: { technicalLead: { vote: "conditional", strengths: [], concerns: [], comment: "Review needed" }, hrDirector: { vote: "conditional", strengths: [], concerns: [], comment: "Review needed" }, ceo: { vote: "conditional", strengths: [], concerns: [], comment: "Review needed" } },
        deliveryReport: { overallDelivery: 60, readingVsSpeaking: "mixed", confidence: 60, clarity: 60, pacing: "good", fillerUsage: "moderate", authenticityScore: 60, deliveryStrengths: [], deliveryImprovements: [], coachingTips: [] },
        cheating: { risk: data.metrics.tabSwitches > 3 ? "high" : "low", findings: [], resumeDiscrepancies: [], recommendation: "Manual review" },
        questionScores: data.answers.map((a) => ({ q: a.question, score: a.evaluation?.score || 0, contentFeedback: a.evaluation?.feedback || "", deliveryFeedback: a.evaluation?.deliveryFeedback || "", interviewer: a.interviewer })),
        strengths: [], improvements: [], advice: [],
        resumeFit: { score: 50, matchedSkills: [], missingSkills: [], overclaimedAreas: [] },
      });
    }
    setLoading(false);
  }

  if (loading) return <Spinner text="Generating Evaluation Report" sub="Panel deliberating + analyzing voice delivery..." />;
  if (!report) return null;

  const vc = scoreColor(report.overallScore);
  const vi = { "STRONG HIRE": "🏆", HIRE: "✅", CONDITIONAL: "⚡", "NOT SELECTED": "❌" };
  const tabs = ["overview", "delivery", "questions", "integrity"];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "30px 20px 60px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div className="fu" style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--fm)", color: "var(--a)" }}>Interview Evaluation Report</h1>
          <div style={{ color: "var(--tm)", fontSize: 12, marginTop: 4 }}>{data.config.candidateName} · {fmt(data.elapsed)} · {new Date().toLocaleDateString()}</div>
        </div>

        {/* Verdict */}
        <Card className="fu" glow style={{ textAlign: "center", marginBottom: 24, borderColor: `${vc}33` }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>{vi[report.verdict] || "📋"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: vc, fontFamily: "var(--fm)", letterSpacing: 2 }}>{report.verdict}</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: vc, fontFamily: "var(--fm)", margin: "6px 0" }}>{report.overallScore}<span style={{ fontSize: 20, color: "var(--tm)" }}>/100</span></div>
          <div style={{ color: "var(--td)", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.5 }}>{report.verdictReason}</div>
        </Card>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--s)", borderRadius: 10, padding: 4 }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeTab === t ? "var(--a)" : "transparent",
              color: activeTab === t ? "#fff" : "var(--tm)",
              fontSize: 12, fontWeight: 600, fontFamily: "var(--fm)", textTransform: "uppercase", letterSpacing: 1,
              transition: "all .2s",
            }}>{t}</button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="fu">
            <Card style={{ marginBottom: 18 }}>
              <Label>Score Breakdown</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {Object.entries(report.scores || {}).map(([k, v]) => {
                  const c = scoreColor(v);
                  return (
                    <div key={k}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: "var(--td)" }}>{SCORE_META[k]?.icon} {SCORE_META[k]?.label || k}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: "var(--fm)" }}>{v}%</span>
                      </div>
                      <Bar value={v} color={c} />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Panel reviews */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
              {[["technicalLead", "⚙️", "Tech Lead", "var(--a)"], ["hrDirector", "👥", "HR Director", "#22d3ee"], ["ceo", "🏢", "CEO", "var(--p)"]].map(([k, icon, title, color]) => {
                const r = report.panel?.[k]; if (!r) return null;
                const vc2 = r.vote === "hire" ? "var(--g)" : r.vote === "no_hire" ? "var(--r)" : "var(--w)";
                return (
                  <Card key={k} style={{ borderColor: `${color}22`, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color }}>{title}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: vc2, fontFamily: "var(--fm)", textTransform: "uppercase" }}>{r.vote?.replace("_", " ")}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--td)", lineHeight: 1.5, marginBottom: 8 }}>{r.comment}</div>
                    {r.strengths?.map((s, i) => <div key={i} style={{ fontSize: 11, color: "var(--g)", marginBottom: 1 }}>+ {s}</div>)}
                    {r.concerns?.map((c, i) => <div key={i} style={{ fontSize: 11, color: "var(--r)", marginBottom: 1 }}>- {c}</div>)}
                  </Card>
                );
              })}
            </div>

            {/* Resume fit */}
            {report.resumeFit && data.config.resumeText && (
              <Card style={{ marginBottom: 18 }}>
                <Label color="var(--g)">📄 Resume vs Live Performance</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor(report.resumeFit.score), fontFamily: "var(--fm)" }}>{report.resumeFit.score}%</div>
                  <div style={{ flex: 1 }}><Bar value={report.resumeFit.score} color={scoreColor(report.resumeFit.score)} h={7} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[["✓ Matched Skills", report.resumeFit.matchedSkills, "var(--g)"], ["⚠ Missing", report.resumeFit.missingSkills, "var(--w)"], ["✗ Overclaimed", report.resumeFit.overclaimedAreas, "var(--r)"]].map(([t, items, c]) => items?.length > 0 && (
                    <div key={t}><div style={{ fontSize: 10, fontWeight: 700, color: c, fontFamily: "var(--fm)", marginBottom: 4 }}>{t}</div>{items.map((s, i) => <div key={i} style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>• {s}</div>)}</div>
                  ))}
                </div>
              </Card>
            )}

            {/* Strengths & improvements */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <Card><Label color="var(--g)">Strengths</Label>{(report.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--td)", marginBottom: 6, lineHeight: 1.5 }}>✦ {s}</div>)}</Card>
              <Card><Label color="var(--w)">Improvements</Label>{(report.improvements || []).map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--td)", marginBottom: 6, lineHeight: 1.5 }}>→ {s}</div>)}</Card>
            </div>

            {report.advice?.length > 0 && (
              <Card style={{ marginBottom: 18, borderColor: "rgba(88,166,255,.15)" }}>
                <Label>💡 Actionable Advice</Label>
                {report.advice.map((a, i) => <div key={i} style={{ fontSize: 13, color: "var(--td)", marginBottom: 10, lineHeight: 1.6, paddingLeft: 14, borderLeft: "2px solid rgba(88,166,255,.2)" }}>{a}</div>)}
              </Card>
            )}
          </div>
        )}

        {/* ── DELIVERY TAB ── */}
        {activeTab === "delivery" && (
          <div className="fu">
            <Card style={{ marginBottom: 18 }}>
              <Label>🎤 Voice Delivery Analysis</Label>
              {report.deliveryReport && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
                    {[
                      ["Delivery", report.deliveryReport.overallDelivery + "%", scoreColor(report.deliveryReport.overallDelivery || 0)],
                      ["Confidence", report.deliveryReport.confidence + "%", scoreColor(report.deliveryReport.confidence || 0)],
                      ["Clarity", report.deliveryReport.clarity + "%", scoreColor(report.deliveryReport.clarity || 0)],
                      ["Authenticity", report.deliveryReport.authenticityScore + "%", scoreColor(report.deliveryReport.authenticityScore || 0)],
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: "center", padding: 12, background: "var(--s2)", borderRadius: 8 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: c, fontFamily: "var(--fm)" }}>{v}</div>
                        <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 2 }}>{l}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
                    {[
                      ["Speaking Style", report.deliveryReport.readingVsSpeaking, report.deliveryReport.readingVsSpeaking === "natural" ? "var(--g)" : report.deliveryReport.readingVsSpeaking === "reading" ? "var(--r)" : "var(--w)"],
                      ["Pacing", report.deliveryReport.pacing?.replace("_", " "), report.deliveryReport.pacing === "good" ? "var(--g)" : "var(--w)"],
                      ["Filler Words", report.deliveryReport.fillerUsage, report.deliveryReport.fillerUsage === "minimal" ? "var(--g)" : report.deliveryReport.fillerUsage === "moderate" ? "var(--w)" : "var(--r)"],
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ padding: 12, background: "var(--s2)", borderRadius: 8 }}>
                        <div style={{ fontSize: 10, color: "var(--tm)", fontFamily: "var(--fm)", marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: c, textTransform: "capitalize" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Per-answer voice metrics */}
              <Label>Per-Answer Voice Stats</Label>
              {data.answers.filter((a) => a.answer !== "[SKIPPED]").map((a, i) => (
                <div key={i} style={{ padding: 12, background: "var(--s2)", borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--a)", marginBottom: 6, fontWeight: 600 }}>Q{i + 1}: {a.question.substring(0, 80)}...</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {[
                      ["Words", a.voiceMetrics?.totalWords || 0],
                      ["WPM", a.voiceMetrics?.wordsPerMinute || 0],
                      ["Fillers", a.voiceMetrics?.fillerWords || 0],
                      ["Pauses", a.voiceMetrics?.pauseCount || 0],
                      ["Speaking %", (a.voiceMetrics?.speakingRatio || 0) + "%"],
                      ["Time", a.responseTime + "s"],
                    ].map(([l, v]) => (
                      <div key={l} style={{ fontSize: 11, color: "var(--td)" }}>
                        <span style={{ color: "var(--tm)" }}>{l}: </span>
                        <span style={{ fontFamily: "var(--fm)", fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {a.evaluation?.deliveryAnalysis?.readingVsSpeaking && (
                    <div style={{ marginTop: 6, fontSize: 11, color: a.evaluation.deliveryAnalysis.readingVsSpeaking === "natural" ? "var(--g)" : a.evaluation.deliveryAnalysis.readingVsSpeaking === "reading" ? "var(--r)" : "var(--w)" }}>
                      {a.evaluation.deliveryAnalysis.readingVsSpeaking === "reading" ? "⚠ Sounds read/scripted" : a.evaluation.deliveryAnalysis.readingVsSpeaking === "natural" ? "✓ Natural spoken delivery" : "~ Mixed delivery"}
                    </div>
                  )}
                </div>
              ))}
            </Card>

            {/* Coaching tips */}
            {report.deliveryReport?.deliveryStrengths?.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                <Card><Label color="var(--g)">Delivery Strengths</Label>{report.deliveryReport.deliveryStrengths.map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--td)", marginBottom: 6, lineHeight: 1.5 }}>✦ {s}</div>)}</Card>
                <Card><Label color="var(--w)">Delivery Improvements</Label>{(report.deliveryReport.deliveryImprovements || []).map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--td)", marginBottom: 6, lineHeight: 1.5 }}>→ {s}</div>)}</Card>
              </div>
            )}
            {report.deliveryReport?.coachingTips?.length > 0 && (
              <Card style={{ borderColor: "rgba(88,166,255,.15)" }}>
                <Label>🎯 Voice Coaching Tips</Label>
                {report.deliveryReport.coachingTips.map((t, i) => <div key={i} style={{ fontSize: 13, color: "var(--td)", marginBottom: 10, lineHeight: 1.6, paddingLeft: 14, borderLeft: "2px solid rgba(88,166,255,.2)" }}>{t}</div>)}
              </Card>
            )}
          </div>
        )}

        {/* ── QUESTIONS TAB ── */}
        {activeTab === "questions" && (
          <div className="fu">
            <Card>
              <Label>Question-by-Question Analysis</Label>
              {(report.questionScores || []).map((q, i) => {
                const c = scoreColor(q.score * 10);
                const origAns = data.answers[i];
                return (
                  <div key={i} style={{ padding: 14, background: "var(--s2)", borderRadius: 8, marginBottom: 10, borderLeft: `3px solid ${c}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ flex: 1, marginRight: 12 }}>
                        <div style={{ fontSize: 10, color: "var(--tm)", fontFamily: "var(--fm)", marginBottom: 3 }}>{q.interviewer} · {origAns?.phase}</div>
                        <div style={{ fontSize: 13, color: "var(--t)", lineHeight: 1.5 }}>{q.q}</div>
                      </div>
                      <div style={{ textAlign: "center", minWidth: 50 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: c, fontFamily: "var(--fm)" }}>{q.score}/10</div>
                      </div>
                    </div>

                    {/* Answer preview */}
                    {origAns?.answer && origAns.answer !== "[SKIPPED]" && (
                      <details style={{ marginBottom: 8 }}>
                        <summary style={{ fontSize: 11, color: "var(--a)", cursor: "pointer", fontFamily: "var(--fm)" }}>Your answer ({origAns.voiceMetrics?.totalWords || 0} words, {origAns.responseTime}s)</summary>
                        <div style={{ marginTop: 6, padding: 10, background: "var(--bg)", borderRadius: 6, fontSize: 12, color: "var(--td)", lineHeight: 1.6, maxHeight: 150, overflow: "auto", border: "1px solid var(--bd)" }}>{origAns.answer}</div>
                      </details>
                    )}

                    {q.contentFeedback && <div style={{ fontSize: 12, color: "var(--td)", lineHeight: 1.5, marginBottom: 4 }}><strong style={{ color: "var(--a)" }}>Content: </strong>{q.contentFeedback}</div>}
                    {q.deliveryFeedback && <div style={{ fontSize: 12, color: "var(--td)", lineHeight: 1.5 }}><strong style={{ color: "var(--w)" }}>Delivery: </strong>{q.deliveryFeedback}</div>}

                    {/* Cheating flags per answer */}
                    {origAns?.evaluation?.cheating?.appearsRead && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "var(--r)", fontFamily: "var(--fm)" }}>⚠ Sounds read/scripted (confidence: {origAns.evaluation.cheating.confidence}%)</div>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {/* ── INTEGRITY TAB ── */}
        {activeTab === "integrity" && (
          <div className="fu">
            <Card style={{ marginBottom: 18, borderColor: ["critical","high"].includes(report.cheating?.risk) ? "rgba(248,81,73,.25)" : "var(--bd)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Label color={report.cheating?.risk === "low" ? "var(--g)" : "var(--r)"}>🛡️ Integrity Analysis</Label>
                <span style={{
                  padding: "4px 12px", borderRadius: 14, fontSize: 10, fontWeight: 700,
                  fontFamily: "var(--fm)", textTransform: "uppercase",
                  background: report.cheating?.risk === "low" ? "rgba(63,185,80,.12)" : report.cheating?.risk === "medium" ? "rgba(210,153,34,.12)" : "rgba(248,81,73,.12)",
                  color: report.cheating?.risk === "low" ? "var(--g)" : report.cheating?.risk === "medium" ? "var(--w)" : "var(--r)",
                }}>{report.cheating?.risk} risk</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--td)", lineHeight: 1.6, marginBottom: 14 }}>{report.cheating?.recommendation}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  [data.metrics.tabSwitches, "Tab Switches", data.metrics.tabSwitches > 3],
                  [data.metrics.patterns.length, "Total Flags", data.metrics.patterns.length > 5],
                  [data.metrics.copyPastes, "Copy/Paste", data.metrics.copyPastes > 0],
                  [`${data.metrics.integrity}%`, "Integrity", data.metrics.integrity < 70],
                ].map(([v, l, bad]) => (
                  <div key={l} style={{ textAlign: "center", padding: 10, background: "var(--s2)", borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: bad ? "var(--r)" : "var(--g)", fontFamily: "var(--fm)" }}>{v}</div>
                    <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
              {report.cheating?.findings?.length > 0 && (
                <div style={{ padding: 12, background: "rgba(248,81,73,.04)", borderRadius: 8, marginBottom: 12 }}>
                  <Label color="var(--r)">Findings</Label>
                  {report.cheating.findings.map((f, i) => <div key={i} style={{ fontSize: 12, color: "var(--td)", marginBottom: 3 }}>• {f}</div>)}
                </div>
              )}
              {report.cheating?.resumeDiscrepancies?.length > 0 && (
                <div style={{ padding: 12, background: "rgba(248,81,73,.04)", borderRadius: 8 }}>
                  <Label color="var(--r)">Resume vs Answer Discrepancies</Label>
                  {report.cheating.resumeDiscrepancies.map((d, i) => <div key={i} style={{ fontSize: 12, color: "var(--td)", marginBottom: 3 }}>⚠ {d}</div>)}
                </div>
              )}
            </Card>

            {/* All flags timeline */}
            {data.metrics.patterns.length > 0 && (
              <Card>
                <Label>Flag Timeline</Label>
                {data.metrics.patterns.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--bd)" }}>
                    <span style={{ fontSize: 12 }}>{p.severity === "critical" ? "🔴" : p.severity === "high" ? "🟡" : "⚪"}</span>
                    <span style={{ fontSize: 11, color: "var(--td)", flex: 1, fontFamily: "var(--fm)" }}>{p.type.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: 10, color: "var(--tm)" }}>{new Date(p.time).toLocaleTimeString()}</span>
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 8,
                      background: p.severity === "critical" ? "rgba(248,81,73,.12)" : p.severity === "high" ? "rgba(210,153,34,.12)" : "rgba(255,255,255,.04)",
                      color: p.severity === "critical" ? "var(--r)" : p.severity === "high" ? "var(--w)" : "var(--tm)",
                      fontFamily: "var(--fm)", fontWeight: 700,
                    }}>{p.severity}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn primary onClick={() => {
            const sc = (v) => v >= 80 ? "#22c55e" : v >= 60 ? "#eab308" : "#ef4444";
            const vi = {"STRONG HIRE":"🏆","HIRE":"✅","CONDITIONAL":"⚡","NOT SELECTED":"❌"};
            const fmtTime = (s) => Math.floor(s/60) + "m " + (s%60) + "s";
            const escHtml = (s) => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

            const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Interview Report - ${escHtml(data?.config?.candidateName)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;padding:32px;max-width:900px;margin:0 auto;line-height:1.6}
@media print{body{padding:16px;font-size:11px}.no-print{display:none}}
h1{font-size:24px;text-align:center;margin-bottom:4px}h2{font-size:16px;color:#2563eb;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}
.sub{text-align:center;color:#666;font-size:13px;margin-bottom:24px}
.verd{text-align:center;padding:24px;margin:16px 0;border-radius:12px;background:#f8fafc;border:2px solid #e5e7eb}
.vt{font-size:28px;font-weight:800;letter-spacing:2px}.vs{font-size:48px;font-weight:800;margin:8px 0}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
.si{padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
.sl{font-size:13px;color:#555}.sv{font-size:15px;font-weight:700;font-family:monospace}
.pg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}.pc{padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb}
.pn{font-size:13px;font-weight:700;color:#2563eb;margin-bottom:4px}.pv{font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:8px}
.qi{padding:12px 16px;margin-bottom:8px;border-left:3px solid #ddd;background:#fafafa;border-radius:0 8px 8px 0}
.qa{font-size:12px;color:#666;margin-top:8px;padding:10px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;white-space:pre-wrap}
.qf{font-size:12px;color:#555;margin-top:6px}.qm{font-size:11px;color:#999;margin-top:4px}
.ig{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px}.ii{text-align:center;padding:10px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb}
.iv{font-size:18px;font-weight:700;font-family:monospace}.il{font-size:10px;color:#999;margin-top:2px}
.dg{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:16px}
.di{text-align:center;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb}
.dv{font-size:18px;font-weight:700;font-family:monospace}.dl{font-size:11px;color:#999}
.str{color:#16a34a;margin-bottom:4px;font-size:13px}.imp{color:#d97706;margin-bottom:4px;font-size:13px}
.adv{font-size:13px;color:#555;padding:8px 0 8px 14px;border-left:2px solid #2563eb;margin-bottom:8px}
.ft{text-align:center;color:#999;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb}
</style></head><body>
<h1>🎯 Interview Evaluation Report</h1>
<div class="sub">${escHtml(data?.config?.candidateName)} · ${fmtTime(data?.elapsed||0)} · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>

<div class="verd">
<div style="font-size:36px;margin-bottom:8px">${vi[report.verdict]||"📋"}</div>
<div class="vt" style="color:${sc(report.overallScore)}">${escHtml(report.verdict)}</div>
<div class="vs" style="color:${sc(report.overallScore)}">${report.overallScore}/100</div>
<div style="font-size:14px;color:#666;max-width:500px;margin:0 auto">${escHtml(report.verdictReason)}</div>
</div>

<h2>📊 Score Breakdown</h2>
<div class="sg">${Object.entries(report.scores||{}).map(([k,v])=>`<div class="si"><span class="sl">${escHtml(k.replace(/([A-Z])/g," $1").trim())}</span><span class="sv" style="color:${sc(v)}">${v}%</span></div>`).join("")}</div>

<h2>👥 Panel Reviews</h2>
<div class="pg">${[["technicalLead","⚙️ Tech Lead"],["hrDirector","👥 HR Director"],["ceo","🏢 CEO"]].map(([k,label])=>{const r=report.panel?.[k];if(!r)return"";const vc=r.vote==="hire"?"#16a34a":r.vote==="no_hire"?"#ef4444":"#d97706";return`<div class="pc"><div class="pn">${label}</div><div class="pv" style="color:${vc}">${(r.vote||"").replace("_"," ")}</div><div style="font-size:12px;color:#555;line-height:1.5;margin-bottom:6px">${escHtml(r.comment)}</div>${(r.strengths||[]).map(s=>`<div style="font-size:11px;color:#16a34a">+ ${escHtml(s)}</div>`).join("")}${(r.concerns||[]).map(c=>`<div style="font-size:11px;color:#ef4444">- ${escHtml(c)}</div>`).join("")}</div>`;}).join("")}</div>

${report.deliveryReport?`<h2>🎤 Voice Delivery Analysis</h2>
<div class="dg">${[["Delivery",report.deliveryReport.overallDelivery],["Confidence",report.deliveryReport.confidence],["Clarity",report.deliveryReport.clarity],["Authenticity",report.deliveryReport.authenticityScore]].map(([l,v])=>`<div class="di"><div class="dv" style="color:${sc(v||0)}">${v||0}%</div><div class="dl">${l}</div></div>`).join("")}</div>
<div class="sg"><div class="si"><span class="sl">Style</span><span class="sv">${escHtml(report.deliveryReport.readingVsSpeaking)}</span></div><div class="si"><span class="sl">Pacing</span><span class="sv">${escHtml((report.deliveryReport.pacing||"").replace("_"," "))}</span></div><div class="si"><span class="sl">Fillers</span><span class="sv">${escHtml(report.deliveryReport.fillerUsage)}</span></div></div>
${report.deliveryReport.coachingTips?.length?`<h3 style="font-size:14px;margin:12px 0 6px">🎯 Coaching Tips</h3>${report.deliveryReport.coachingTips.map(t=>`<div class="adv">${escHtml(t)}</div>`).join("")}`:""}`:""}

<h2>📝 Question-by-Question Analysis & Full Transcripts</h2>
${(report.questionScores||[]).map((q,i)=>{const ans=data?.answers?.[i];return`<div class="qi" style="border-left-color:${sc(q.score*10)}">
<div style="display:flex;justify-content:space-between;margin-bottom:6px">
<div><span style="font-size:10px;color:#999">${escHtml(q.interviewer)} · Q${i+1}${ans?.phase?" · "+escHtml(ans.phase):""}</span><div style="font-size:13px;font-weight:600">${escHtml(q.q)}</div></div>
<div style="font-size:20px;font-weight:800;font-family:monospace;color:${sc(q.score*10)};min-width:50px;text-align:right">${q.score}/10</div></div>
${ans&&ans.answer!=="[SKIPPED]"?`<div class="qa">${escHtml(ans.answer)}</div><div class="qm">Words: ${ans.voiceMetrics?.totalWords||0} · WPM: ${ans.voiceMetrics?.wordsPerMinute||0} · Fillers: ${ans.voiceMetrics?.fillerWords||0} · Response Time: ${ans.responseTime||0}s</div>`:`<div class="qa" style="color:#ef4444;font-style:italic">SKIPPED</div>`}
${q.contentFeedback?`<div class="qf"><strong>Content:</strong> ${escHtml(q.contentFeedback)}</div>`:""}
${q.deliveryFeedback?`<div class="qf"><strong>Delivery:</strong> ${escHtml(q.deliveryFeedback)}</div>`:""}
</div>`;}).join("")}

<h2>✅ Strengths</h2>
${(report.strengths||[]).map(s=>`<div class="str">✦ ${escHtml(s)}</div>`).join("")}

<h2>⚡ Areas for Improvement</h2>
${(report.improvements||[]).map(s=>`<div class="imp">→ ${escHtml(s)}</div>`).join("")}

${report.advice?.length?`<h2>💡 Actionable Advice</h2>${report.advice.map(a=>`<div class="adv">${escHtml(a)}</div>`).join("")}`:""}

<h2>🛡️ Interview Integrity</h2>
<div class="ig">
<div class="ii"><div class="iv" style="color:${(data?.metrics?.tabSwitches||0)>3?"#ef4444":"#22c55e"}">${data?.metrics?.tabSwitches||0}</div><div class="il">Tab Switches</div></div>
<div class="ii"><div class="iv" style="color:${(data?.metrics?.patterns?.length||0)>5?"#ef4444":"#22c55e"}">${data?.metrics?.patterns?.length||0}</div><div class="il">Flags</div></div>
<div class="ii"><div class="iv" style="color:${(data?.metrics?.copyPastes||0)>0?"#ef4444":"#22c55e"}">${data?.metrics?.copyPastes||0}</div><div class="il">Copy/Paste</div></div>
<div class="ii"><div class="iv" style="color:${sc(data?.metrics?.integrity||0)}">${data?.metrics?.integrity||0}%</div><div class="il">Score</div></div>
</div>
${report.cheating?.recommendation?`<div style="font-size:13px;color:#555;margin-top:12px">${escHtml(report.cheating.recommendation)}</div>`:""}

${report.resumeFit&&data?.config?.resumeText?`<h2>📄 Resume vs Performance</h2>
<div style="font-size:18px;font-weight:800;color:${sc(report.resumeFit.score)};margin-bottom:12px">${report.resumeFit.score}% Match</div>
<div class="sg">
${(report.resumeFit.matchedSkills||[]).length?`<div class="si" style="flex-direction:column;align-items:flex-start"><div class="sl" style="color:#16a34a;font-weight:600;margin-bottom:4px">✓ Matched</div><div style="font-size:12px">${report.resumeFit.matchedSkills.map(escHtml).join(", ")}</div></div>`:""}
${(report.resumeFit.missingSkills||[]).length?`<div class="si" style="flex-direction:column;align-items:flex-start"><div class="sl" style="color:#d97706;font-weight:600;margin-bottom:4px">⚠ Missing</div><div style="font-size:12px">${report.resumeFit.missingSkills.map(escHtml).join(", ")}</div></div>`:""}
${(report.resumeFit.overclaimedAreas||[]).length?`<div class="si" style="flex-direction:column;align-items:flex-start"><div class="sl" style="color:#ef4444;font-weight:600;margin-bottom:4px">✗ Overclaimed</div><div style="font-size:12px">${report.resumeFit.overclaimedAreas.map(escHtml).join(", ")}</div></div>`:""}
</div>`:""} 

<div class="ft">Interview Simulator Pro · Generated ${new Date().toISOString()} · AI-Powered Evaluation</div>
</body></html>`;

            // Download as HTML file
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `interview-report-${data?.config?.candidateName?.replace(/\s+/g,"-")||"report"}-${new Date().toISOString().slice(0,10)}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }} style={{ padding: "12px 32px" }}>
            💾 Download Report (HTML)
          </Btn>
          <Btn onClick={() => {
            // Open print dialog for PDF save
            const sc = (v) => v >= 80 ? "#22c55e" : v >= 60 ? "#eab308" : "#ef4444";
            const vi = {"STRONG HIRE":"🏆","HIRE":"✅","CONDITIONAL":"⚡","NOT SELECTED":"❌"};
            const fmtTime = (s) => Math.floor(s/60) + "m " + (s%60) + "s";
            const escHtml = (s) => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            const w = window.open("", "_blank");
            w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Interview Report</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;padding:24px;max-width:860px;margin:0 auto;line-height:1.5;font-size:12px}
h1{font-size:20px;text-align:center;margin-bottom:2px}h2{font-size:14px;color:#2563eb;margin:18px 0 8px;padding-bottom:4px;border-bottom:2px solid #e5e7eb}
.sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}
.verd{text-align:center;padding:16px;margin:12px 0;border:2px solid #e5e7eb;border-radius:8px}
.vt{font-size:22px;font-weight:800}.vs{font-size:36px;font-weight:800;margin:4px 0}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.si{padding:6px 10px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb;display:flex;justify-content:space-between}
.pg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.pc{padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb;font-size:11px}
.qi{padding:8px 12px;margin-bottom:6px;border-left:3px solid #ddd;background:#fafafa;border-radius:0 6px 6px 0}
.qa{font-size:11px;color:#555;margin-top:6px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:4px;white-space:pre-wrap}
.qf{font-size:11px;color:#555;margin-top:4px}.qm{font-size:10px;color:#999;margin-top:3px}
.ig{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px}.ii{text-align:center;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb}
.ft{text-align:center;color:#999;font-size:10px;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb}
</style></head><body>
<h1>🎯 Interview Report</h1>
<div class="sub">${escHtml(data?.config?.candidateName)} · ${fmtTime(data?.elapsed||0)} · ${new Date().toLocaleDateString()}</div>
<div class="verd"><div style="font-size:28px">${vi[report.verdict]||"📋"}</div><div class="vt" style="color:${sc(report.overallScore)}">${escHtml(report.verdict)}</div><div class="vs" style="color:${sc(report.overallScore)}">${report.overallScore}/100</div></div>
<h2>Scores</h2><div class="sg">${Object.entries(report.scores||{}).map(([k,v])=>`<div class="si"><span>${k.replace(/([A-Z])/g," $1")}</span><span style="font-weight:700;color:${sc(v)}">${v}%</span></div>`).join("")}</div>
<h2>Q&A Transcripts</h2>${(report.questionScores||[]).map((q,i)=>{const ans=data?.answers?.[i];return`<div class="qi" style="border-left-color:${sc(q.score*10)}"><div style="display:flex;justify-content:space-between"><div><span style="font-size:9px;color:#999">${escHtml(q.interviewer)}</span><div style="font-size:12px;font-weight:600">${escHtml(q.q)}</div></div><span style="font-size:16px;font-weight:800;color:${sc(q.score*10)}">${q.score}/10</span></div>${ans&&ans.answer!=="[SKIPPED]"?`<div class="qa">${escHtml(ans.answer)}</div><div class="qm">Words:${ans.voiceMetrics?.totalWords||0} WPM:${ans.voiceMetrics?.wordsPerMinute||0} Fillers:${ans.voiceMetrics?.fillerWords||0} Time:${ans.responseTime||0}s</div>`:`<div class="qa" style="color:red">SKIPPED</div>`}${q.contentFeedback?`<div class="qf"><b>Content:</b> ${escHtml(q.contentFeedback)}</div>`:""}${q.deliveryFeedback?`<div class="qf"><b>Delivery:</b> ${escHtml(q.deliveryFeedback)}</div>`:""}</div>`;}).join("")}
<div class="ft">Interview Simulator Pro · ${new Date().toISOString()}</div>
</body></html>`);
            w.document.close();
            setTimeout(() => w.print(), 500);
          }} style={{ padding: "12px 32px", background: "var(--a)", borderColor: "var(--a)", color: "#fff" }}>
            📄 Save as PDF
          </Btn>
          <Btn onClick={() => window.location.reload()} style={{ padding: "12px 32px" }}>Start New Interview</Btn>
        </div>
      </div>
    </div>
  );
}
