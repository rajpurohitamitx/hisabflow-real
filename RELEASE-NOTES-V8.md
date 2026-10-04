# Hisab Flow V8 — payment allocation, customer identity, wake-word fixes

Date: 04 Oct 2026

## Fixed

1. **Payment cuts an existing due**
   - `RECEIVE_PAYMENT` detects explicit outstanding/due allocation language.
   - If a customer has open sales, payment is allocated oldest-first and updates `amountPaid`, `balanceDue`, `Payment`, `PaymentAllocation`, and receivable ledger.
   - If a legacy sale was accidentally saved as Walk-in, the system can safely relink it only when there is exactly one confirmed unassigned sale with an exact matching due amount.
   - Multiple possible unassigned invoices are rejected rather than guessed.
   - The payment cannot silently become an advance when the user explicitly asked to cut an outstanding due and an exact legacy match exists.

2. **Customer name is retained on sales**
   - AI sale execution no longer silently saves a named customer as a Walk-in customer.
   - Exact customer matches are resolved automatically.
   - Multiple matches require customer selection.
   - New customer creation happens only after the explicit customer-creation confirmation.
   - Sales list rows remain clickable and the invoice detail page shows customer/profile, products, quantities, rates, total, paid, due, payment history, invoice, source and status.

3. **Hi Hisab wake listener**
   - Wake-word listener continuously re-arms after SpeechRecognition `end` and recoverable errors.
   - Recognizes common recognition variants such as Hi/Hey/Hai/Hello + Hisab/Hisaab/Hesab.
   - Wake listener is re-armed after the user turns live voice off.
   - During active voice mode, microphone capture is stopped while Hisab speaks and resumes afterward.
   - Existing manual voice controls remain available as fallback.

## Validation performed

- `node scripts/validate-architecture.mjs` — passed.
- `node scripts/validate-ultra-voice.mjs` — passed.
- TypeScript parser run was attempted, but the runtime did not have project `node_modules`; `npm install --ignore-scripts --no-audit --no-fund` timed out. Therefore a dependency-complete `next build` could not be run in this environment.

## V9 hotfix (04 Oct 2026)

- Prevented stale conversation `customerId` from overriding an explicitly named customer.
- Added generic name-vs-pronoun context isolation instead of hard-coded customer names.
- Added execution-time customer identity verification: if an action says Jinal but carries Ramesh's ID, execution refuses the mismatch and re-resolves Jinal.
- Wake listener is now persistent and independently re-arms; it also supports `Hi Hisab, <query>` in one utterance.
