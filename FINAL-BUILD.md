# Hisab Flow — Final God Mode Build

This build uses the **Next.js + React + TypeScript + PostgreSQL + Prisma** architecture as the canonical product base.

## What is implemented in this build

- Multi-tenant authentication and business isolation
- Customer/supplier CRM and ledgers
- Sales, purchases, payments, allocations, advances and expenses
- Inventory, stock movements, reorder points, valuation, batch/expiry/serial data
- Quotes/estimates model and live quote API
- Sales returns and inventory restoration workflow
- Cash opening/closing sessions
- Approval records
- Recurring transaction schedules
- Integration connection registry
- CSV customer/product import
- Document extraction endpoint using OpenAI vision/file input
- Advanced reporting endpoint
- Audit log + AI action provenance
- Business memory and aliases
- AI natural-language interpretation with tenant-scoped entity resolution
- AI financial risk/confirmation gate
- AI execution through deterministic business services
- Browser recording fallback
- Server transcription
- AI speech output
- Low-latency Realtime/WebRTC voice endpoint with a server-side OpenAI API key
- Live voice tool bridge to the same `/api/ask` business interpreter
- Premium responsive UI and operations center
- Vercel/Next.js deployment configuration
- Node 24 CI/deployment target (local Node >=22.16 supported)
- Production security headers

## Voice architecture

The live voice mode uses WebRTC to OpenAI Realtime. The browser never receives the normal OpenAI API key. The server creates the Realtime call and the model can call the `hisab_command` tool. That tool is routed back to the tenant-scoped Hisab Flow AI interpreter. Financial mutations still pass through the confirmation gate and deterministic services.

OpenAI's current Realtime API supports WebRTC, speech-to-speech, server VAD, multilingual transcription, tool/function calling and configurable voice/speed. The Assistants API is sunset; new integrations should use Responses/Realtime APIs.

## Required production environment

```env
DATABASE_URL="postgresql://..."
SESSION_SECRET="at-least-32-random-characters"
OPENAI_API_KEY="sk-..."
OPENAI_TEXT_MODEL="gpt-5"
OPENAI_TRANSCRIBE_MODEL="gpt-4o-transcribe"
OPENAI_TTS_MODEL="gpt-4o-mini-tts"
OPENAI_REALTIME_MODEL="gpt-realtime"
OPENAI_REALTIME_VOICE="marin"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

External connectors such as WhatsApp Business, payment gateways, banking, GST portals, Tally/Zoho/Vyapar and e-commerce still require their real provider credentials and approved APIs. The codebase exposes tenant-scoped integration records instead of pretending an external service is connected.

## Deployment

1. Create a managed PostgreSQL database.
2. Set all environment variables in Vercel.
3. Vercel runs `npm run build`; production builds apply checked-in migrations with `prisma migrate deploy`, then generate Prisma Client and build Next.js.
4. For CI, use the included PostgreSQL service tests and E2E workflow.
5. Deploy the Next.js project to Vercel; the included GitHub workflow can automate this when Vercel secrets are configured.
6. Never expose `DATABASE_URL`, `SESSION_SECRET` or `OPENAI_API_KEY` to the browser.

Vercel's native Next.js platform supports zero-config deployment and managed HTTPS. Node 24 is the current recommended runtime target for new Vercel projects.
