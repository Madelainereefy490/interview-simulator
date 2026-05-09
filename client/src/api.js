export async function callClaude(system, userMsg, maxTokens = 2048) {
  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages: [{ role: "user", content: userMsg }], max_tokens: maxTokens }),
    });
    if (!res.ok) { const e = await res.json(); console.error("API error:", e); return ""; }
    const data = await res.json();
    return data.content?.[0]?.text || "";
  } catch (e) { console.error(e); return ""; }
}

export function parseJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); }
  catch (e) { return null; }
}

export async function parseResume(file) {
  const fd = new FormData();
  fd.append("resume", file);
  const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

export const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
