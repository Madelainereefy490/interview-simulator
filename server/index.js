require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

const PORT = process.env.PORT || 3001;
const PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();

// ══════════════════════════════════════════
//  MULTI-PROVIDER AI CONFIG
// ══════════════════════════════════════════
const PROVIDERS = {
  anthropic: {
    key: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    host: "api.anthropic.com",
    path: "/v1/messages",
    buildHeaders: (key, bodyLen) => ({
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Length": bodyLen,
    }),
    buildBody: (model, system, messages, maxTokens) => ({
      model, max_tokens: maxTokens, system: system || "", messages,
    }),
    extractText: (data) => data?.content?.[0]?.text || "",
    normalize: (data) => data,
  },
  openai: {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o",
    host: "api.openai.com",
    path: "/v1/chat/completions",
    buildHeaders: (key, bodyLen) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "Content-Length": bodyLen,
    }),
    buildBody: (model, system, messages, maxTokens) => ({
      model, max_tokens: maxTokens,
      messages: [{ role: "system", content: system || "" }, ...messages],
    }),
    extractText: (data) => data?.choices?.[0]?.message?.content || "",
    normalize: (data) => ({
      content: [{ type: "text", text: data?.choices?.[0]?.message?.content || "" }],
      model: data?.model,
    }),
  },
  google: {
    key: process.env.GOOGLE_API_KEY,
    model: process.env.GOOGLE_MODEL || "gemini-2.0-flash",
    host: "generativelanguage.googleapis.com",
    pathFn: (model, key) => `/v1beta/models/${model}:generateContent?key=${key}`,
    buildHeaders: (key, bodyLen) => ({
      "Content-Type": "application/json",
      "Content-Length": bodyLen,
    }),
    buildBody: (model, system, messages, maxTokens) => ({
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens },
    }),
    extractText: (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text || "",
    normalize: (data) => ({
      content: [{ type: "text", text: data?.candidates?.[0]?.content?.parts?.[0]?.text || "" }],
    }),
  },
  groq: {
    key: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    host: "api.groq.com",
    path: "/openai/v1/chat/completions",
    buildHeaders: (key, bodyLen) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "Content-Length": bodyLen,
    }),
    buildBody: (model, system, messages, maxTokens) => ({
      model, max_tokens: maxTokens,
      messages: [{ role: "system", content: system || "" }, ...messages],
    }),
    extractText: (data) => data?.choices?.[0]?.message?.content || "",
    normalize: (data) => ({
      content: [{ type: "text", text: data?.choices?.[0]?.message?.content || "" }],
      model: data?.model,
    }),
  },
  deepseek: {
    key: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    host: "api.deepseek.com",
    path: "/v1/chat/completions",
    buildHeaders: (key, bodyLen) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "Content-Length": bodyLen,
    }),
    buildBody: (model, system, messages, maxTokens) => ({
      model, max_tokens: maxTokens,
      messages: [{ role: "system", content: system || "" }, ...messages],
    }),
    extractText: (data) => data?.choices?.[0]?.message?.content || "",
    normalize: (data) => ({
      content: [{ type: "text", text: data?.choices?.[0]?.message?.content || "" }],
      model: data?.model,
    }),
  },
  openrouter: {
    key: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4-5-20250929",
    host: "openrouter.ai",
    path: "/api/v1/chat/completions",
    buildHeaders: (key, bodyLen) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "Content-Length": bodyLen,
    }),
    buildBody: (model, system, messages, maxTokens) => ({
      model, max_tokens: maxTokens,
      messages: [{ role: "system", content: system || "" }, ...messages],
    }),
    extractText: (data) => data?.choices?.[0]?.message?.content || "",
    normalize: (data) => ({
      content: [{ type: "text", text: data?.choices?.[0]?.message?.content || "" }],
      model: data?.model,
    }),
  },
};

const provider = PROVIDERS[PROVIDER];
if (!provider) {
  console.error(`\n❌ Unknown AI_PROVIDER: "${PROVIDER}"`);
  console.error(`   Supported: ${Object.keys(PROVIDERS).join(", ")}\n`);
  process.exit(1);
}
if (!provider.key) {
  const keyName = `${PROVIDER.toUpperCase()}_API_KEY`;
  console.error(`\n❌ ${keyName} not set in .env file`);
  console.error(`   1. Copy .env.example to .env`);
  console.error(`   2. Set AI_PROVIDER=${PROVIDER}`);
  console.error(`   3. Add your ${keyName}\n`);
  process.exit(1);
}

// ── Generic AI call ──
function callAI(system, messages, maxTokens = 2048) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(provider.buildBody(provider.model, system, messages, maxTokens));
    const apiPath = provider.pathFn ? provider.pathFn(provider.model, provider.key) : provider.path;
    const headers = provider.buildHeaders(provider.key, Buffer.byteLength(body));

    const req = https.request({
      hostname: provider.host, path: apiPath, method: "POST", headers,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(JSON.stringify(parsed.error)));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error("API parse error: " + data.substring(0, 500)));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error("API timeout after 120s")); });
    req.write(body);
    req.end();
  });
}

// ══════════════════════════════════════════
//  EXPRESS APP
// ══════════════════════════════════════════
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 20 * 1024 * 1024 } });

// ── AI Chat endpoint ──
app.post("/api/claude", async (req, res) => {
  try {
    const { system, messages, max_tokens = 2048 } = req.body;
    const result = await callAI(system, messages || [], max_tokens);
    res.json(provider.normalize(result));
  } catch (err) {
    console.error(`${PROVIDER} API error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Resume parsing ──
app.post("/api/parse-resume", upload.single("resume"), async (req, res) => {
  let filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    let text = "";
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === ".pdf") {
      try {
        const pdfParse = require("pdf-parse");
        const buf = fs.readFileSync(filePath);
        const data = await pdfParse(buf);
        text = (data.text || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/\s{3,}/g, "  ").trim();
        console.log(`PDF: ${data.numpages} pages, ${text.length} chars`);
        if (text.length < 20) {
          return res.status(400).json({ error: "PDF is scanned/image-based. Save as text-based PDF or .txt format." });
        }
      } catch (e) {
        console.error("PDF error:", e.message);
        return res.status(400).json({ error: "Cannot read PDF: " + e.message + ". Try .txt format." });
      }
    } else {
      text = fs.readFileSync(filePath, "utf-8");
      if ([".doc", ".docx"].includes(ext)) {
        text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").trim();
      }
    }

    if (filePath) try { fs.unlinkSync(filePath); } catch (e) {}
    if (!text || text.trim().length < 20) return res.status(400).json({ error: "Text too short. Use .txt or text-based .pdf" });
    res.json({ text: text.trim(), chars: text.trim().length });
  } catch (err) {
    if (filePath) try { fs.unlinkSync(filePath); } catch (e) {}
    res.status(500).json({ error: err.message });
  }
});

// ── LinkedIn scraper ──
app.post("/api/scrape-linkedin", async (req, res) => {
  try {
    const { profiles, jd } = req.body;
    if (!profiles?.length) return res.status(400).json({ error: "No profiles" });

    const scraped = [];
    for (const p of profiles) {
      let info = { name: p.name, role: p.role, linkedin: p.linkedin, bio: "" };
      if (p.linkedin?.includes("linkedin.com")) {
        try {
          const html = await fetchUrl(p.linkedin.replace(/\/$/, ""));
          const title = html?.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
          const desc = html?.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1]?.trim() ||
                       html?.match(/<meta[^>]*content="([^"]+)"[^>]*name="description"/i)?.[1]?.trim() || "";
          info.bio = `${title} | ${desc}`;
        } catch (e) { /* scrape failed, AI will infer from name/role */ }
      }
      scraped.push(info);
    }

    const prompt = scraped.map((s, i) =>
      `${i + 1}. Name: ${s.name}\n   Role: ${s.role || "unknown"}\n   LinkedIn: ${s.bio || s.linkedin || "not provided"}`
    ).join("\n\n");

    const result = await callAI(
      `You are an interview intelligence analyst. Analyze each interviewer and predict their interview behavior. ONLY valid JSON:\n{"profiles":[{"name":"","likelyRole":"","inferredBackground":"","experienceLevel":"","expectedFocusAreas":[],"likelyQuestionStyle":"deep-dive|rapid-fire|scenario-based|conversational","difficultyLevel":"moderate|hard|expert","personalityType":"analytical|collaborative|challenging|detail-oriented|big-picture","tipsForCandidate":[],"potentialTraps":[],"recommendedPrep":[]}],"panelDynamics":"","overallStrategy":""}`,
      [{ role: "user", content: `Job Description:\n${(jd || "").substring(0, 1500)}\n\nInterviewers:\n${prompt}` }],
      2048
    );
    const text = provider.extractText(result);
    res.json({ analysis: text, raw: scraped });
  } catch (err) {
    console.error("LinkedIn error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── URL fetcher ──
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0", "Accept": "text/html", "Accept-Language": "en-US" },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ── Health & config ──
app.get("/api/health", (req, res) => res.json({ status: "ok", provider: PROVIDER, model: provider.model, uptime: Math.floor(process.uptime()) }));
app.get("/api/config", (req, res) => res.json({ provider: PROVIDER, model: provider.model }));

// ── Serve React build ──
const buildPath = path.join(__dirname, "../client/build");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get("*", (req, res) => res.sendFile(path.join(buildPath, "index.html")));
}

app.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║     Interview Simulator Pro v3.0         ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\n✅ Server: http://localhost:${PORT}`);
  console.log(`🤖 Provider: ${PROVIDER}`);
  console.log(`📦 Model: ${provider.model}`);
  console.log(`🔑 Key: ${provider.key.substring(0, 15)}...`);
  console.log(`\n🎯 Open http://localhost:3000 in Chrome\n`);
});
