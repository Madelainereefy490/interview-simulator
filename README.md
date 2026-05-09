<div align="center">

# 🎯 Interview Simulator Pro

### AI Mock Interview with Voice, Camera & Anti-Cheat

**Practice with an AI that talks like a real Tech Lead, HR Director, and CEO — not a chatbot.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Quick Start](#-quick-start) · [Features](#-features) · [AI Providers](#-supported-ai-providers) · [Contributing](#-contributing)

</div>

---

## ⚡ Why This Exists

Mock interviews cost $50-200/session. AI chatbots test how you type, not how you speak. This tool gives you **free, unlimited, voice-based mock interviews** with AI that evaluates both **what you say** and **how you say it**.

- 🎤 **Voice recording** with real-time transcription
- 📹 **Webcam feed** for realistic interview experience
- 📄 **Resume probing** — AI asks about YOUR specific projects and gaps
- 🔍 **LinkedIn profiling** — predicts interviewer style before you start
- 🛡️ **Anti-cheat** — detects tab switching, copy-paste, reading from notes
- 📊 **Full report** with panel reviews, delivery coaching, and downloadable PDF

> Works with **6 AI providers** including **Groq and Google Gemini (both free!)**

---

## 🚀 Quick Start

```bash
git clone https://github.com/paragsen/interview-simulator.git
cd interview-simulator
cp .env.example .env    # Add your API key
npm install && cd client && npm install && cd ..
npm start               # Opens http://localhost:3000
```

**Windows:** Double-click `start.bat`

**Requirements:** Node.js 18+, Chrome/Edge, any API key from table below.

---

## 🤖 Supported AI Providers

| Provider | Free? | Set in `.env` |
|---|---|---|
| **Groq** | ✅ Free | `AI_PROVIDER=groq` + `GROQ_API_KEY=gsk_...` |
| **Google** | ✅ Free | `AI_PROVIDER=google` + `GOOGLE_API_KEY=AIza...` |
| **Anthropic** | $5 min | `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY=sk-ant-...` |
| **OpenAI** | $5 min | `AI_PROVIDER=openai` + `OPENAI_API_KEY=sk-proj-...` |
| **DeepSeek** | Cheap | `AI_PROVIDER=deepseek` + `DEEPSEEK_API_KEY=sk-...` |
| **OpenRouter** | Varies | `AI_PROVIDER=openrouter` + `OPENROUTER_API_KEY=sk-or-...` |

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎤 Voice Recording | Speak naturally, AI transcribes + analyzes delivery |
| 📹 Camera Feed | Webcam active throughout interview |
| 🧠 Human-Like Questions | Blunt Tech Lead, warm HR, big-picture CEO |
| 📄 Resume Deep-Dive | Probes your specific projects, gaps, claimed metrics |
| 🔍 Interviewer Profiling | Predicts style from LinkedIn before you start |
| 🛡️ Anti-Cheat | Tab switch, paste, timing, reading detection |
| 📊 Panel Evaluation | 3 interviewers vote independently |
| 🎤 Delivery Coaching | WPM, filler words, confidence, authenticity |
| 💾 PDF Report | Downloadable with full Q&A transcripts |
| ⏹ End Anytime | Stop early and get evaluation on answers so far |

---

## 📊 How It Works

```
Setup → Interview → Evaluate → Report
 │         │           │          │
 ├ JD      ├ AI asks   ├ Content  ├ Verdict
 ├ Resume  ├ You speak ├ Delivery ├ Panel votes
 ├ Panel   ├ Camera on ├ Integrity├ Transcripts
 └ Config  └ Anti-cheat└ Resume   └ PDF download
```

---

## 🤝 Contributing

Contributions welcome! Fork, create a branch, submit a PR.

**Ideas:**
- [ ] Dark/light theme
- [ ] Interview history tracking
- [ ] Multi-language support
- [ ] Mobile responsive
- [ ] Timed mode with countdown
- [ ] Video recording playback

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">
<b>If this helped you prepare, give it a ⭐</b>
</div>
