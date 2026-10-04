# Hisab Flow V11 — Universal Conversational Action Engine

V11 is the conversational architecture release. The user interacts through Ask Hisab only; the model interprets natural language into safe business actions and the deterministic engine performs the database work.

## Key fixes
- Explicit customer names override stale conversation context.
- Strict customer identity matching: Ram cannot silently resolve to Ramesh.
- Confirmation replies are executed against the original pending action exactly once; "yes" is never re-interpreted as a new command.
- Universal `MANAGE_ENTITY` action for conversational create/update/archive/cancel/complete operations across customers, products, suppliers, expenses and reminders.
- Archive is used for master-data deletion; financial history is preserved.
- Read-only requests do not create customers or mutate records.
- Existing sale/payment/purchase/stock deterministic services remain the accounting execution layer.
- Voice session continues listening after responses where browser permissions/APIs allow it.

## Safety
Financial mutations remain confirmation-gated. The AI never directly writes accounting records; `/api/ai/execute` validates and performs the transaction.
