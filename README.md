# Hisab Flow — Production Architecture Build

Hisab Flow is being rebuilt as an AI-native business operating system, following the supplied architecture brief.

## Stack

- Next.js + React + TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- OpenAI Responses API adapter (optional; deterministic parser works without a provider key)
- Browser speech recognition foundation
- S3-compatible storage interface planned
- Redis/BullMQ interface planned
- React Native/Expo planned for mobile
- WhatsApp Business API planned as a channel using the same business engine

Next.js is a full-stack React framework and supports the application/server structure used here. Prisma documents the Next.js + PostgreSQL integration path. The project intentionally keeps accounting truth in PostgreSQL and uses AI only for interpretation/orchestration.

## Core architecture

```text
Web / Voice / Future WhatsApp / Future Mobile
                    ↓
             AI Orchestrator
                    ↓
       Intent + Entity Resolution
                    ↓
        Context + Business Memory
                    ↓
       Validation + Permissions
                    ↓
          Business Rules
                    ↓
          Business Services
                    ↓
              PostgreSQL
                    ↓
          Audit / AI Action Log
```

AI never directly writes accounting records.

## Implemented foundation

- Multi-tenant Business + Membership model
- Owner/manager/accountant/cashier/etc. role foundation
- Customer CRM
- Suppliers
- Products/SKU/barcode/unit/reorder point
- Inventory movements
- Sales/invoices
- Purchases
- Payments and payment allocations
- Customer receivables ledger
- Supplier payables ledger foundation
- Expenses
- Reminders
- Business memory
- Industry configuration
- Conversations
- AI actions
- Audit logs
- Notifications/automation data model
- Document data model
- Dashboard from real database records
- AI workspace with confirmation flow
- Natural-language deterministic fallback parser
- Optional OpenAI Responses API interpretation adapter
- Browser voice input foundation
- AI activity/audit view
- Customer detail timeline
- Inventory workspace
- Sales workspace
- Expense workspace

## Demo seed

`npm run db:seed` creates a demo business and the following local-only credentials:

- Email: `owner@hisabflow.local`
- Password: `HisabFlow@123`

Do not use these credentials in production.

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `SESSION_SECRET` (32+ random characters)
- `OPENAI_API_KEY` if using hosted LLM interpretation
- `OPENAI_TEXT_MODEL` (or legacy `OPENAI_MODEL`) for text interpretation, plus `OPENAI_TRANSCRIBE_MODEL` and `OPENAI_TTS_MODEL` for full voice

## Local setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Important production rules

1. Use PostgreSQL as the financial source of truth.
2. Use Decimal/decimal-safe calculations for money.
3. Use transactions for multi-record financial operations.
4. Never destructively delete accounting history.
5. Use reversals/adjustments for corrections.
6. Keep tenant/business authorization on every resource access.
7. AI interpretation is not accounting execution.
8. High-risk actions require explicit confirmation/approval.
9. Never show fabricated dashboard values.
10. External integrations must be adapters around the core engine.

## Current intentionally unimplemented integrations

These are not represented as fake working buttons:

- WhatsApp Business API delivery
- Real bank/UPI integrations
- Production OCR provider
- Tally/Zoho/Vyapar migration connectors
- Offline sync worker/conflict resolution
- S3 production storage adapter
- Redis/BullMQ worker deployment
- Production GST filing integration
- Thermal printer drivers
- Native mobile app
- Advanced forecasting/ML service

The database and service boundaries are designed so those systems can be added without rewriting accounting logic.

## Hi Hisab voice-first mode

Hisab Flow now includes a persistent voice assistant in the authenticated app shell. After the user activates **Hi Hisab**, the assistant:

- keeps the voice session active while the app is open;
- records short speech turns with browser MediaRecorder and sends them to Gemini 3.5 Transcribe;
- automatically listens again after clarification questions and voice confirmations;
- treats `yes`, `go ahead`, Hindi/Tamil/etc. equivalents, and customer/location replies as answers to the current pending question;
- resolves customers/products against tenant-scoped business data before financial actions;
- executes low-risk read actions automatically;
- requires one spoken confirmation for financial mutations;
- keeps keyboard, Enter, mouse and touch controls available as fallback;
- supports the wake phrase `Hi Hisab` through the browser speech-recognition wake listener when the browser supports it.

The browser wake listener is intentionally limited to the open web app. A true system-wide background wake word requires a native Android/iOS implementation with OS-level background microphone permissions.
