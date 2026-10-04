# Hisab Flow Final Verification

- Payment receipts never create sales. `RECEIVE_PAYMENT` only creates a Payment and allocates it to existing open customer sales oldest-first; excess becomes an advance.
- Sale totals and inventory are calculated by the deterministic business engine from resolved product records.
- Product quantity/value conversion uses the stored selling price and explicit units.
- A confirmed pending action is executed directly once; a bare yes/haan/ஆம் cannot repeatedly re-confirm the same action.
- Sales rows are clickable and open a complete invoice view with customer, purchased products, rates, quantities, payments and balance. Walk-in sales clearly state that no customer profile is attached.
- Customer names link to their customer profile.
- New customer creation and ambiguous entity resolution remain confirmation-protected.
- Read-only questions are not allowed to inherit an unrelated pending mutation.
