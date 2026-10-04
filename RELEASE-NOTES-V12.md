# Hisab Flow v12 — Universal Conversation Safety + Full Operations Demo

## P0 fixed
- Persisted pending-action state on Conversation.
- Field-level PATCH of pending actions instead of reinterpreting every follow-up.
- Confirmation/cancellation is tied to the exact pending AIAction.
- Explicit customer names override stale conversational customer IDs.
- Payment language is protected from accidental CREATE_SALE classification.
- Read queries are protected from accidental financial mutations.
- Destructive/vague phrases such as “leave” no longer archive a customer when no action is pending.
- Settlement uses the actual current outstanding balance; no amount is invented.
- Sale/purchase execution now respects `paidAmount` when supplied by the interpreter.
- Reminder execution uses the actual parsed due date/time instead of silently changing it to next Monday.
- Current-year date normalization for `DD Mon` reminder input.
- Confirmation UI renders nested fields rather than `[object Object]`.

## P1 fixed
- Customer top-N transaction queries.
- Customer balance follow-ups.
- Purchase amount-threshold search output is shown in chat.
- Contextual amount-only payment follow-ups.
- Better customer/payment correction handling.
- Historical records remain intact when customer records are archived.

## P2 fixed
- One-click demo business loader for Operations Center.
- Populates customers, products, suppliers, sales, purchases, payments, expenses, quotes, batches, serials, approvals, migration job, cash session, recurring automation and reminders.
- Opening stock creates an inventory movement for traceability.

## P3 hardening
- Database migration for persisted pending actions.
- Release/version bump to 3.2.0.
- Human-readable confirmation values for dates, money and nested fields.
- No duplicate demo data after the seed marker exists.

## Verification note
This artifact was statically inspected and syntax-checked with the available global TypeScript compiler. A full dependency-backed Next.js/Prisma build requires installing the project dependencies; the runtime environment used for packaging did not complete `npm install` within the available execution window.
