# Hisab Flow V10 — Customer Identity Isolation + Wake Reliability

## Critical fixes

### 1. Explicit customer names cannot inherit stale customer IDs
- `Jinal paid...` cannot execute against a previous Ramesh ID.
- `tell me everything about Jinal` cannot read Ramesh's statement.
- If the AI returns `customerName=Jinal` and `customerId=<Ramesh>`, the current explicit name is authoritative and the stale ID is discarded.
- Conversation customer context is cleared when an explicit named customer is present but unresolved.

### 2. Strict customer resolution
- Exact customer name or exact alias is accepted.
- Exact customer name followed by extra location/detail is accepted.
- Fuzzy matching is no longer allowed to turn `Ram` into `Ramesh`.
- Ambiguous exact matches require clarification.

### 3. New-customer correction flow
The following is understood as a correction to the pending customer:
- `not Ramesh its a new customer Ram`
- `not Ramesh, it is a new customer named Ram from Anna Nagar`
- common `custmer` transcription typo is accepted.

The pending sale/payment is retained, the stale customer ID is removed, and Ram is proposed as the new customer.

### 4. Customer-sensitive execution guard
Before payment/sale/statement/balance/reminder execution, the deterministic execution layer rebinds the action to the current explicit customer name. It refuses to silently use another customer.

### 5. Read-only actions never create customers
Customer statement/balance queries will not create a missing customer merely because the model set `createCustomer=true`.

### 6. Safe customer removal
`remove/delete/archive <customer>` is interpreted as `DELETE_CUSTOMER` and requires confirmation. The implementation archives the customer and keeps historical sales/payments intact.

### 7. Hi Hisab wake reliability
- On Ask Hisab page load, the app requests microphone permission so Chrome has a chance to authorize the wake listener.
- Wake recognition is re-armed after recognition end/error.
- Wake detection supports Hi/Hey/Hai/Hello + Hisab/Hisaab/Hesab/Hisab Flow.
- After wake, the normal Gemini voice flow continues and returns to listening after speech output.

## Validation
- Source brace/parenthesis balance checked.
- TypeScript parser run with the available global compiler. Full type/build validation remains dependency-limited in this runtime because project dependencies are not installed.
