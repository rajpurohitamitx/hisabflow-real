# Hisab Flow V19 — Idempotent AI Action Execution

## Critical fix
Fixed the user-facing error:

> This action is already being processed. Please wait for the result.

The problem occurred when the same confirmation reached `/api/ai/execute` more than once while the first request had already claimed the AIAction as `CONFIRMED`.

## New behavior
- First request atomically claims the action.
- Duplicate/retried request sees `CONFIRMED` and waits briefly for the original transaction.
- If the original request finishes, the duplicate receives the same executed result.
- Accounting mutation still executes exactly once.
- If execution fails/rejects, the duplicate receives a safe failure response.
- If execution takes unusually long, the duplicate reports that it is still processing without implying a second execution.

## Safety invariant
`AIAction` remains idempotent: one confirmed action cannot create duplicate sales, payments, purchases, expenses, reminders, or stock movements merely because the client retries the request.

## Note
This fixes the execution race. It does not claim that the full project TypeScript/build has been validated in this runtime because project dependencies are not installed here.
