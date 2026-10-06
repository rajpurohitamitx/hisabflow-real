# Hisab Flow V15 — Universal Conversation + Persistent Memory Safety Fix

## What this release fixes

### P0
- Pending mutations now survive clarification turns instead of being discarded.
- Follow-up answers patch the existing pending action instead of starting a new action.
- `yes/haan/ஆம்/go ahead/confirm` resolves only the persisted pending action.
- `no/cancel/stop` rejects the pending action.
- Bare `leave` is never treated as archive/delete; the UI asks whether to cancel the pending action.
- Explicit current customer names override stale conversation customer IDs.
- Server-side execution re-binds explicit customer names before every customer-sensitive action.
- Payment language is protected from accidental CREATE_SALE classification.
- Read-only queries are protected from accidental financial mutations.
- Financial actions are claimed idempotently before execution to reduce double execution races.
- Completed AI actions clear the server-side pending conversation state.
- Failed claimed actions are marked FAILED so they can be retried safely.
- UI-selected entity corrections are persisted to the AI action before execution.

### Reminder/date fixes
- Relative dates such as `today`, `tomorrow`, and `day after tomorrow` are normalized deterministically in India time.
- `04 Oct 18:00 PM` normalizes to 18:00 and the current business year when no year is supplied.
- Reminder title/date patches preserve existing fields instead of replacing the entire pending action.

### Supplier safety
- Explicit supplier names are re-resolved server-side for purchase execution.
- Stale supplier IDs are not silently trusted when an explicit supplier name is present.

### Test assets
- Added `scripts/ai-regression-cases.json` with golden conversational cases.
- Added `scripts/validate-ai-regression-contract.mjs` to verify the critical safety architecture.

## Architecture rule
AI interprets and proposes. The deterministic business services execute. PostgreSQL remains the source of truth. Business memory is contextual knowledge, not a replacement for accounting records.

## Verification
- `node scripts/validate-architecture.mjs` — PASS
- `node scripts/validate-ai-regression-contract.mjs` — PASS (9 architecture checks, 14 golden cases)
- Full `npm install` / production TypeScript build could not be completed in this runtime because dependency installation timed out. Do not treat this release as a claim that Vercel/npm production compilation has been independently verified here.
