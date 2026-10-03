# Hisab Flow — Vercel Free AI setup

This build is designed to run on Vercel without Ollama, a terminal, or an OpenAI API key.

## Vercel environment variables

Keep the existing database variables created by Vercel:

- `POSTGRES_URL`
- `DATABASE_URL`
- `PRISMA_DATABASE_URL`

Add:

- `SESSION_SECRET` — random 32+ character secret
- `AI_PROVIDER` = `gemini`
- `GEMINI_API_KEY` = your Google AI Studio API key
- `GEMINI_MODEL` = `gemini-2.5-flash`
- `NEXT_PUBLIC_AI_PROVIDER` = `gemini`
- `NEXT_PUBLIC_VOICE_CAPTURE` = `on`

Do not expose `GEMINI_API_KEY` with `NEXT_PUBLIC_`.

## Voice

The free Vercel build uses the browser microphone and browser speech recognition/speech synthesis. Audio is not sent to Hisab Flow's server by the normal microphone flow; recognized text is sent to the `/api/ask` endpoint and Gemini handles the language interpretation server-side.

## Switching later

The AI provider is isolated. When funding is available, a future deployment can switch the provider to a paid model without changing the accounting engine.
