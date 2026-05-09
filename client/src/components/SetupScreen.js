import React, { useState } from "react";
import { Btn, Card, Label, inputStyle } from "./UI";
import { callClaude, parseJSON, parseResume } from "../api";

const PHASES_DESC = [
  "Introduction (1-2 Qs)",
  "Resume Deep-Dive (3-4 Qs)",
  "Technical Round (4-6 Qs)",
  "Behavioral (3-4 Qs)",
  "Situational (2-3 Qs)",
  "Closing (1-2 Qs)",
];

export default function SetupScreen({ onStart }) {
  const [step, setStep] = useState(1);
  const [jd, setJd] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("5-7");
  const [diff, setDiff] = useState("intermediate");
  const [mode, setMode] = useState("comprehensive");
  const [resume, setResume] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeStatus, setResumeStatus] = useState("");
  const [resumeParsed, setResumeParsed] = useState(null);
  const [interviewers, setInterviewers] = useState([{ name: "", linkedin: "", role: "" }]);
  const [profiles, setProfiles] = useState(null);
  const [profiling, setProfiling] = useState(false);

  const ok1 = name.trim().length > 1 && jd.trim().length > 50;

  async function handleResume(file) {
    setResume(file);
    setResumeParsed(null);
    setResumeText("");
    const ext = file.name.split(".").pop().toLowerCase();
    try {
      setResumeStatus(ext === "pdf" ? "Extracting PDF text..." : "Reading file...");
      const text = await parseResume(file);
      setResumeText(text);
      setResumeStatus("Analyzing with AI...");
      const raw = await callClaude(
        `Parse resume into JSON. ONLY valid JSON, no markdown:\n{"name":"","totalExperience":"","skills":{"primary":[],"secondary":[],"tools":[]},"experience":[{"company":"","role":"","duration":"","highlights":[]}],"education":[{"institution":"","degree":"","year":""}],"certifications":[],"gaps":["gaps/inconsistencies"],"strengths":["top 3"],"weaknesses":["areas interviewers probe"]}`,
        `Resume:\n${text.substring(0, 8000)}`,
        2048
      );
      setResumeParsed(parseJSON(raw) || { rawText: text });
      setResumeStatus("");
    } catch (e) {
      setResumeStatus("⚠ Error: " + e.message + ". Try .txt format.");
    }
  }

  async function analyzeInterviewers() {
    const valid = interviewers.filter((i) => i.name.trim());
    if (!valid.length) return;
    setProfiling(true);
    try {
      // Use server-side scraping for LinkedIn profiles
      const res = await fetch("/api/scrape-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles: valid, jd: jd }),
      });
      const data = await res.json();
      if (data.analysis) {
        setProfiles(parseJSON(data.analysis));
      } else if (data.error) {
        // Fallback to AI-only analysis
        const raw = await callClaude(
          `Predict interviewer behavior. ONLY valid JSON:\n{"profiles":[{"name":"","likelyRole":"","inferredBackground":"","expectedFocusAreas":[],"likelyQuestionStyle":"","difficultyLevel":"","tipsForCandidate":[],"potentialTraps":[]}],"overallStrategy":""}`,
          `JD:\n${jd.substring(0, 1500)}\n\nInterviewers:\n${valid.map((i, idx) => `${idx + 1}. ${i.name} | ${i.linkedin || "no LinkedIn"} | ${i.role || "unknown"}`).join("\n")}`,
          2048
        );
        setProfiles(parseJSON(raw));
      }
    } catch (e) {
      console.error("Profile analysis error:", e);
    }
    setProfiling(false);
  }

  function startInterview() {
    onStart({
      jd, candidateName: name, experienceLevel: exp, difficulty: diff,
      interviewMode: mode, resumeText, resumeParsed,
      interviewerProfiles: profiles?.profiles || [], interviewers,
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div className="fu" style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--fm)", color: "var(--a)" }}>
            Interview Simulator Pro
          </h1>
          <p style={{ color: "var(--tm)", fontSize: 13, marginTop: 6 }}>
            AI-powered · Voice + Camera · Anti-cheat · Full analysis
          </p>
        </div>

        {/* Step nav */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28, alignItems: "center" }}>
          {["JD & Config", "Resume", "Interviewers"].map((label, i) => (
            <React.Fragment key={i}>
              <div
                onClick={() => i + 1 <= step && setStep(i + 1)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, cursor: i + 1 <= step ? "pointer" : "default",
                  padding: "5px 14px", borderRadius: 20,
                  background: i + 1 === step ? "rgba(88,166,255,.12)" : "transparent",
                  border: `1px solid ${i + 1 === step ? "var(--a)" : i + 1 < step ? "var(--g)" : "var(--bd)"}`,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--fm)",
                  background: i + 1 < step ? "var(--g)" : i + 1 === step ? "var(--a)" : "var(--s2)",
                  color: i + 1 <= step ? "#fff" : "var(--tm)",
                }}>{i + 1 < step ? "✓" : i + 1}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: i + 1 === step ? "var(--a)" : i + 1 < step ? "var(--g)" : "var(--tm)" }}>{label}</span>
              </div>
              {i < 2 && <div style={{ width: 20, height: 1, background: "var(--bd)" }} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: JD ── */}
        {step === 1 && (
          <div className="fu">
            <Card>
              <Label>Candidate Name</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" style={inputStyle} />
              <div style={{ height: 20 }} />
              <Label>Job Description *</Label>
              <textarea
                value={jd} onChange={(e) => setJd(e.target.value)}
                placeholder="Paste complete JD — role, responsibilities, required skills, qualifications. More detail = more realistic interview."
                rows={8} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              />
              <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 4 }}>
                {jd.length} chars {jd.length < 50 ? "— need 50+" : "✓"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 20 }}>
                <div>
                  <Label>Experience Level</Label>
                  <select value={exp} onChange={(e) => setExp(e.target.value)} style={inputStyle}>
                    {["0-2", "3-5", "5-7", "8-10", "10+"].map((v) => <option key={v} value={v}>{v} years</option>)}
                  </select>
                </div>
                <div>
                  <Label>Difficulty</Label>
                  <select value={diff} onChange={(e) => setDiff(e.target.value)} style={inputStyle}>
                    {[["easy", "Junior"], ["intermediate", "Mid"], ["hard", "Senior"], ["expert", "Lead/Architect"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Duration</Label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)} style={inputStyle}>
                    {[["quick", "Quick ~15m"], ["comprehensive", "Full ~40m"], ["deep", "Deep ~60m"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Interview structure preview */}
              <div style={{ marginTop: 20, padding: 14, background: "var(--s2)", borderRadius: 8, border: "1px solid var(--bd)" }}>
                <Label>Interview Structure</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {PHASES_DESC.map((p, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: "rgba(88,166,255,.08)", border: "1px solid rgba(88,166,255,.15)", color: "var(--a)" }}>{p}</span>
                  ))}
                </div>
              </div>
            </Card>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <Btn primary disabled={!ok1} onClick={() => setStep(2)}>Continue → Resume</Btn>
            </div>
          </div>
        )}

        {/* ── Step 2: Resume ── */}
        {step === 2 && (
          <div className="fu">
            <Card>
              <Label>📄 Upload Resume</Label>
              <p style={{ fontSize: 13, color: "var(--td)", marginBottom: 16, lineHeight: 1.6 }}>
                The interviewer will probe your specific experience, verify project claims, and cross-check your live answers against your resume for consistency.
              </p>
              <div
                style={{
                  border: "2px dashed var(--bd2)", borderRadius: 12, padding: 32,
                  textAlign: "center", cursor: "pointer",
                  background: resume && !resumeStatus.startsWith("⚠") ? "rgba(63,185,80,.04)" : "transparent",
                  transition: "border-color .3s",
                }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--a)"; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--bd2)"; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--bd2)"; e.dataTransfer.files[0] && handleResume(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById("resume-file").click()}
              >
                <input id="resume-file" type="file" accept=".pdf,.txt,.md,.doc,.docx,.rtf" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleResume(e.target.files[0])} />
                {resumeStatus && !resumeStatus.startsWith("⚠") ? (
                  <div>
                    <div style={{ width: 28, height: 28, border: "3px solid var(--bd)", borderTopColor: "var(--a)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, color: "var(--a)" }}>{resumeStatus}</div>
                  </div>
                ) : resumeStatus.startsWith("⚠") ? (
                  <div><div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div><div style={{ fontSize: 13, color: "var(--w)" }}>{resumeStatus}</div></div>
                ) : resume ? (
                  <div><div style={{ fontSize: 28, marginBottom: 8 }}>✅</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--g)" }}>{resume.name}</div><div style={{ fontSize: 12, color: "var(--tm)", marginTop: 4 }}>Click to replace</div></div>
                ) : (
                  <div><div style={{ fontSize: 32, marginBottom: 10 }}>📎</div><div style={{ fontSize: 14, color: "var(--td)" }}>Drop resume here or click to upload</div><div style={{ fontSize: 12, color: "var(--tm)", marginTop: 6 }}>.pdf .txt .md .doc supported</div></div>
                )}
              </div>

              {resumeParsed && !resumeParsed.rawText && (
                <div style={{ marginTop: 20, padding: 16, background: "var(--s2)", borderRadius: 8, border: "1px solid var(--bd)" }}>
                  <Label color="var(--g)">✓ Resume Parsed</Label>
                  {resumeParsed.name && <div style={{ fontSize: 13, marginBottom: 6 }}>👤 <span style={{ color: "var(--a)", fontWeight: 600 }}>{resumeParsed.name}</span></div>}
                  {resumeParsed.totalExperience && <div style={{ fontSize: 13, marginBottom: 6 }}>📅 <span style={{ color: "var(--a)", fontWeight: 600 }}>{resumeParsed.totalExperience}</span></div>}
                  {resumeParsed.skills?.primary?.length > 0 && <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 6 }}>Core: {resumeParsed.skills.primary.slice(0, 8).join(" · ")}</div>}
                  {resumeParsed.experience?.length > 0 && <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 6 }}>Roles: {resumeParsed.experience.slice(0, 4).map((e) => `${e.role} @ ${e.company}`).join(" → ")}</div>}
                  {resumeParsed.certifications?.length > 0 && <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 6 }}>Certs: {resumeParsed.certifications.join(" · ")}</div>}
                  {resumeParsed.weaknesses?.length > 0 && (
                    <div style={{ marginTop: 10, padding: 10, background: "rgba(210,153,34,.06)", borderRadius: 6, border: "1px solid rgba(210,153,34,.15)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--w)", fontFamily: "var(--fm)", marginBottom: 4 }}>⚠ AREAS INTERVIEWERS WILL PROBE</div>
                      {resumeParsed.weaknesses.map((w, i) => <div key={i} style={{ fontSize: 12, color: "var(--td)", marginBottom: 2 }}>• {w}</div>)}
                    </div>
                  )}
                  {resumeParsed.gaps?.length > 0 && (
                    <div style={{ marginTop: 8, padding: 10, background: "rgba(248,81,73,.05)", borderRadius: 6, border: "1px solid rgba(248,81,73,.12)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--r)", fontFamily: "var(--fm)", marginBottom: 4 }}>📋 RESUME GAPS</div>
                      {resumeParsed.gaps.map((g, i) => <div key={i} style={{ fontSize: 12, color: "var(--td)", marginBottom: 2 }}>• {g}</div>)}
                    </div>
                  )}
                  {resumeText && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ fontSize: 11, color: "var(--a)", cursor: "pointer", fontFamily: "var(--fm)" }}>View extracted text ({resumeText.length.toLocaleString()} chars)</summary>
                      <pre style={{ marginTop: 8, padding: 10, background: "var(--bg)", borderRadius: 6, fontSize: 11, color: "var(--tm)", lineHeight: 1.5, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--bd)" }}>{resumeText.substring(0, 3000)}{resumeText.length > 3000 ? "\n\n...[truncated]" : ""}</pre>
                    </details>
                  )}
                </div>
              )}
            </Card>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <Btn onClick={() => setStep(1)}>← Back</Btn>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn onClick={() => setStep(3)}>Skip</Btn>
                <Btn primary onClick={() => setStep(3)}>Continue → Interviewers</Btn>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Interviewers ── */}
        {step === 3 && (
          <div className="fu">
            <Card>
              <Label>🔍 Interviewer Intelligence (Optional)</Label>
              <p style={{ fontSize: 13, color: "var(--td)", marginBottom: 16, lineHeight: 1.6 }}>
                Add interviewer names, LinkedIn URLs, or roles. AI predicts their focus areas, question style, and potential traps — then tailors mock questions to match.
              </p>
              {interviewers.map((iv, idx) => (
                <div key={idx} className="si" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr .8fr auto", gap: 10, marginBottom: 10, animationDelay: `${idx * 0.08}s` }}>
                  <input value={iv.name} onChange={(e) => { const u = [...interviewers]; u[idx].name = e.target.value; setInterviewers(u); }} placeholder="Name" style={inputStyle} />
                  <input value={iv.linkedin} onChange={(e) => { const u = [...interviewers]; u[idx].linkedin = e.target.value; setInterviewers(u); }} placeholder="LinkedIn URL or background info" style={inputStyle} />
                  <input value={iv.role} onChange={(e) => { const u = [...interviewers]; u[idx].role = e.target.value; setInterviewers(u); }} placeholder="Role" style={inputStyle} />
                  {idx > 0 ? <button onClick={() => setInterviewers(interviewers.filter((_, i) => i !== idx))} style={{ background: "transparent", border: "none", color: "var(--r)", fontSize: 18, cursor: "pointer" }}>×</button> : <div style={{ width: 18 }} />}
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <Btn small onClick={() => interviewers.length < 5 && setInterviewers([...interviewers, { name: "", linkedin: "", role: "" }])}>+ Add</Btn>
                <Btn small primary onClick={analyzeInterviewers} disabled={profiling || !interviewers.some((i) => i.name.trim())}>{profiling ? "⏳ Analyzing..." : "🔍 Analyze Profiles"}</Btn>
              </div>

              {profiles?.profiles?.map((p, i) => (
                <div key={i} style={{ marginTop: 16, padding: 14, background: "var(--s2)", borderRadius: 8, border: "1px solid var(--bd)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--a)" }}>{p.name} <span style={{ fontSize: 11, color: "var(--tm)", fontWeight: 400 }}>{p.likelyRole}</span></span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(210,153,34,.12)", color: "var(--w)", fontWeight: 600, fontFamily: "var(--fm)" }}>{p.difficultyLevel}</span>
                  </div>
                  {p.inferredBackground && <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 8, lineHeight: 1.5 }}>{p.inferredBackground}</div>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                    {p.expectedFocusAreas?.map((a, j) => <span key={j} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(88,166,255,.08)", border: "1px solid rgba(88,166,255,.15)", color: "var(--a)" }}>{a}</span>)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--tm)", marginBottom: 6 }}>Style: <span style={{ color: "var(--td)" }}>{p.likelyQuestionStyle}</span></div>
                  {p.potentialTraps?.length > 0 && <div style={{ padding: 8, background: "rgba(248,81,73,.05)", borderRadius: 6, marginBottom: 6 }}><div style={{ fontSize: 10, color: "var(--r)", fontWeight: 700, fontFamily: "var(--fm)", marginBottom: 3 }}>WATCH FOR</div>{p.potentialTraps.map((t, k) => <div key={k} style={{ fontSize: 11, color: "var(--td)" }}>⚡ {t}</div>)}</div>}
                  {p.tipsForCandidate?.length > 0 && <div style={{ padding: 8, background: "rgba(63,185,80,.05)", borderRadius: 6 }}><div style={{ fontSize: 10, color: "var(--g)", fontWeight: 700, fontFamily: "var(--fm)", marginBottom: 3 }}>TIPS</div>{p.tipsForCandidate.map((t, k) => <div key={k} style={{ fontSize: 11, color: "var(--td)" }}>💡 {t}</div>)}</div>}
                </div>
              ))}
              {profiles?.overallStrategy && <div style={{ marginTop: 12, padding: 12, background: "rgba(63,185,80,.05)", borderRadius: 8, border: "1px solid rgba(63,185,80,.15)" }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--g)", fontFamily: "var(--fm)", marginBottom: 4 }}>YOUR STRATEGY</div><div style={{ fontSize: 12, color: "var(--td)", lineHeight: 1.6 }}>{profiles.overallStrategy}</div></div>}
            </Card>

            <Card style={{ marginTop: 14, borderColor: "rgba(210,153,34,.2)", background: "rgba(210,153,34,.03)" }}>
              <div style={{ display: "flex", gap: 14 }}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--w)", marginBottom: 4 }}>Full Anti-Cheat Active</div>
                  <div style={{ fontSize: 12, color: "var(--tm)", lineHeight: 1.6 }}>
                    Tab switches · Window blur · Copy/paste detection · Response timing · Answer pattern analysis · Voice delivery scoring (reading vs natural speech) · Camera monitoring for attention
                  </div>
                </div>
              </div>
            </Card>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <Btn onClick={() => setStep(2)}>← Back</Btn>
              <Btn primary onClick={startInterview}>🎯 Begin Interview</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
