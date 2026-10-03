# Hisab Flow — Free Local AI Mode

This build supports a zero-API-cost local AI mode using Ollama.

## 1. Install Ollama

Install Ollama on the same computer where you will run Hisab Flow.

## 2. Download a local model

Run:

```bash
ollama pull qwen2.5:3b
```

You can later switch `OLLAMA_MODEL` to another model you have installed.

## 3. Configure `.env.local`

Copy `.env.example` to `.env.local` and set:

```env
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen2.5:3b"
NEXT_PUBLIC_AI_PROVIDER="ollama"
```

Keep your existing `DATABASE_URL` and `SESSION_SECRET` values.

**Do not add an OpenAI API key.** It is not needed in local mode.

## 4. Start Ollama

Ollama normally runs as a local service. If needed, run:

```bash
ollama serve
```

## 5. Start Hisab Flow

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## What is local/free

- Natural-language business interpretation: Ollama/local model
- Copilot planning: Ollama/local model
- Accounting actions: deterministic Hisab Flow backend
- Text-to-speech in the browser: browser SpeechSynthesis
- Voice input: browser SpeechRecognition in local mode
- No OpenAI API key required
- No OpenAI API charges

Browser speech recognition availability and implementation vary by browser. The app does not send recorded audio to the Hisab Flow server in local mode.

## Important deployment note

A Vercel deployment cannot directly call `127.0.0.1:11434` on your laptop. For the completely free local-AI pitch/demo, run the app locally on the presentation laptop. When you later have funding or customers, you can switch the AI provider to a hosted API without changing the accounting engine.
