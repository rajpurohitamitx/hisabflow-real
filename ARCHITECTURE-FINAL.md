# Hisab Flow — Final Architecture

## Product contract

Hisab Flow is a conversational business operating system. The AI may understand natural language, but it never becomes the accounting source of truth. Every financial mutation goes through deterministic business services, validation, permissions and audit logging.

## Voice contract

Microphone → audio capture → server transcription → multilingual/code-mixed interpretation → entity resolution → risk gate → business engine → optional speech synthesis.

The UI also has a browser speech fallback when a voice API is unavailable.

## Performance contract

- Server Components for data-heavy pages.
- Small Client Components only where interaction is needed.
- Indexed PostgreSQL queries.
- Database transactions for financial writes.
- No large client-side state store.
- No AI call for simple deterministic dashboard calculations.
- Background queues are integration-ready for reminders, exports and scheduled jobs.

## Security contract

- Business/tenant isolation on every query.
- Session secret stays server-side.
- AI actions are scoped to the authenticated business.
- Medium/high-risk mutations require confirmation.
- Audit events are written after successful business operations.
- No destructive financial deletion path; corrections should be reversals/adjustments.

## AI contract

The interpreter can return a broad intent vocabulary. Read-only questions can execute without confirmation. Financial mutations require explicit fields and a risk gate. Ambiguous people/products are presented as choices rather than guessed.

## Vercel

Next.js is the primary web/runtime architecture. Vercel provides zero-config Next.js deployment and managed server functions; the application does not expose a public Node port to end users.
