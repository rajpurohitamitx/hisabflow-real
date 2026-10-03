# Hisab Flow Architecture Map

## Domain services

- `lib/services/business.ts` — sales, purchases, payments, expenses, balances, dashboard calculations
- `lib/ai/interpret.ts` — AI interpretation boundary + deterministic fallback
- `lib/audit.ts` — immutable action/audit recording boundary
- `lib/auth.ts` — tenant/session resolution
- `lib/permissions.ts` — role/action policy foundation

## API boundaries

- `/api/auth/*`
- `/api/dashboard`
- `/api/customers`
- `/api/products`
- `/api/sales`
- `/api/purchases`
- `/api/payments`
- `/api/expenses`
- `/api/suppliers`
- `/api/reminders`
- `/api/memory`
- `/api/ask`
- `/api/ai/execute`
- `/api/audit`
- `/api/reports/summary`

## Financial event model

A sale creates:

- sale record
- sale items
- inventory movement(s)
- customer receivable ledger entry when credit is involved
- payment record/allocation if payment is received immediately
- audit event

A later payment creates a new payment event and ledger entry. It does not mutate the historical sale amount.

## Industry engine

`IndustryConfig` stores configurable:

- fields
- rules
- vocabulary
- workflows
- templates

This is the foundation for Retail/Kirana, Wholesale, Jewellery/Silver and future verticals without hardcoding every industry into the core transaction model.
