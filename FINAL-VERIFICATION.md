# Hisab Flow Final Verification

- Payment receipts never create sales. `RECEIVE_PAYMENT` only creates a Payment and allocates it to existing open customer sales oldest-first; excess becomes an advance.
- Sale totals and inventory are calculated by the deterministic business engine from resolved product records.
- Product quantity/value conversion uses the stored selling price and explicit units.
- A confirmed pending action is executed directly once; a bare yes/haan/ஆம் cannot repeatedly re-confirm the same action.
- Sales rows are clickable and open a complete invoice view with customer, purchased products, rates, quantities, payments and balance. Walk-in sales clearly state that no customer profile is attached.
- Customer names link to their customer profile.
- New customer creation and ambiguous entity resolution remain confirmation-protected.
- Read-only questions are not allowed to inherit an unrelated pending mutation.


## V8 fixes (04 Oct 2026)

- Payments explicitly described as cutting a due/outstanding are marked `applyToOutstanding` and never silently become an advance when a matching receivable exists.
- If an old sale was accidentally saved as a walk-in, the payment flow may relink it to the named customer only when there is exactly one confirmed unassigned sale with the exact same due amount; ambiguous matches are rejected rather than guessed.
- AI sale execution now refuses to silently save a named customer as a walk-in. It resolves an exact customer, asks for clarification on ambiguity, or creates a customer only after the explicit customer-creation confirmation.
- Sales rows remain clickable and the detail page shows customer/profile, products, quantities, rates, total, paid, due, payment history, source, status and invoice data.
- Hi Hisab wake-word recognition now continuously re-arms after recognition `end`/recoverable `error`, recognizes common speech-recognition variants, and re-arms after manually turning voice mode off.
- Browser limitation: a normal web app cannot guarantee a background/system-wide wake word or bypass a browser's microphone permission/user-gesture policy. The implementation keeps the in-app wake listener armed whenever the browser permits SpeechRecognition; once microphone/speech permission is granted, `Hi Hisab` can activate without pressing the mic button.
