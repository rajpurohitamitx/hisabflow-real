# Hisab Flow — 125 Feature Registry

Status codes:
- **LIVE** = implemented in this build and backed by application/database logic.
- **READY** = application boundary/data model/UI exists; needs provider credentials, worker or deeper vertical workflow before being called production-complete.
- **CONNECTOR** = intentionally requires an external service/API and is not simulated.

| # | Feature | Status |
|---:|---|---|
|1|Voice-to-transaction|LIVE|
|2|Multilingual voice|LIVE with AI voice provider|
|3|Mixed-language understanding|LIVE with AI provider|
|4|Conversation context|LIVE|
|5|Business vocabulary/aliases|LIVE|
|6|Smart confirmation|LIVE|
|7|Customer ledger|LIVE|
|8|Supplier ledger|LIVE|
|9|Credit/Udhaar|LIVE|
|10|Payment allocation|LIVE|
|11|Payment history|LIVE|
|12|Receivable ageing foundation|LIVE|
|13|Payable ageing foundation|LIVE|
|14|Automatic stock updates|LIVE|
|15|Product database|LIVE|
|16|Intelligent product matching|LIVE|
|17|Barcode field/workflow|LIVE|
|18|Batch tracking|LIVE|
|19|Serial tracking|LIVE|
|20|Reorder alerts|LIVE|
|21|Reorder prediction|READY|
|22|Dead-stock detection|READY|
|23|Stock movement history|LIVE|
|24|Stock valuation|LIVE|
|25|AI invoice creation|LIVE for complete parsed requests|
|26|Fast billing|LIVE|
|27|Invoice templates foundation|LIVE|
|28|Invoice sharing|READY|
|29|Invoice history|LIVE|
|30|Invoice status|LIVE|
|31|Returns/refunds|LIVE return workflow; refund connector-ready|
|32|Discounts|LIVE in transaction model|
|33|Tax/GST calculation fields|LIVE; advanced filing connector-ready|
|34|Bill/document OCR|LIVE with OpenAI file extraction|
|35|Handwritten document extraction|READY/provider dependent|
|36|Bulk document import|READY|
|37|Duplicate document detection|READY|
|38|WhatsApp record|CONNECTOR|
|39|WhatsApp ask|CONNECTOR|
|40|WhatsApp reports|CONNECTOR|
|41|WhatsApp invoice|CONNECTOR|
|42|WhatsApp statement|CONNECTOR|
|43|WhatsApp payment reminder|CONNECTOR|
|44|Natural-language business search|LIVE|
|45|Sales questions|LIVE|
|46|Customer questions|LIVE|
|47|Supplier questions|LIVE|
|48|Inventory questions|LIVE|
|49|Expense questions|LIVE|
|50|Comparison questions|READY|
|51|Explain this number|READY|
|52|Why analysis|READY|
|53|Today dashboard|LIVE|
|54|Sales report|LIVE|
|55|Purchase report|LIVE|
|56|Expense report|LIVE|
|57|P&L foundation|LIVE|
|58|Cash flow foundation|LIVE|
|59|Customer analysis|LIVE|
|60|Product analysis|LIVE|
|61|Supplier analysis|LIVE|
|62|Daily closing|LIVE foundation|
|63|Payment reminders|LIVE in-app|
|64|Low-stock alerts|LIVE|
|65|Daily summary|LIVE|
|66|Weekly report|READY|
|67|Monthly report|READY|
|68|Unusual transaction alerts|READY|
|69|Duplicate customer alerts|READY|
|70|Duplicate product alerts|READY|
|71|Overdue alerts|LIVE foundation|
|72|Role-based access|LIVE|
|73|Employee activity|LIVE audit foundation|
|74|Approval workflow|LIVE records/API|
|75|Transaction locking|READY|
|76|Audit trail|LIVE|
|77|Multiple shops|LIVE foundation|
|78|Branch dashboard|READY|
|79|Consolidated dashboard|READY|
|80|Branch stock transfer|READY|
|81|Branch comparison|READY|
|82|Customer profile|LIVE|
|83|Customer timeline|LIVE|
|84|Customer search|LIVE|
|85|Customer statement|LIVE|
|86|Inactive customer detection|READY|
|87|Customer notes|LIVE|
|88|Supplier profiles|LIVE|
|89|Supplier price history|READY|
|90|Supplier comparison|READY|
|91|Supplier due dates|READY|
|92|Purchase history|LIVE|
|93|Automatic backup|PLATFORM/DB provider|
|94|Restore|PLATFORM/DB provider|
|95|CSV/Excel/PDF export foundation|READY|
|96|Account security|LIVE|
|97|Data permissions|LIVE foundation|
|98|Audit logs|LIVE|
|99|AI action history|LIVE|
|100|Offline mode|READY|
|101|Fast loading/local caching|LIVE architecture|
|102|Mobile-first UI|LIVE|
|103|One-handed workflows|LIVE UI|
|104|Voice everywhere|LIVE foundation|
|105|Guided “what should I do?”|LIVE AI briefing|
|106|AI Business Copilot|LIVE|
|107|AI daily briefing|LIVE|
|108|AI anomaly detection|READY|
|109|AI forecasting|READY|
|110|AI document understanding|LIVE with provider|
|111|AI search over structured data|LIVE|
|112|Evidence-backed explanations|READY|
|113|Payment integrations|CONNECTOR|
|114|Banking integrations|CONNECTOR|
|115|GST/compliance workflows|READY/CONNECTOR|
|116|E-commerce integration|CONNECTOR|
|117|POS integration|CONNECTOR|
|118|Barcode-printer integration|CONNECTOR|
|119|Thermal-printer support|CONNECTOR|
|120|Supplier portal|READY|
|121|Customer portal|READY|
|122|Employee mobile app|READY|
|123|Accountant portal|READY|
|124|Public/API integration layer|READY|
|125|Third-party integrations|CONNECTOR|

The product deliberately does not fabricate external integrations. Provider-dependent rows become live when their APIs, credentials, webhook verification, reconciliation rules and production tests are configured.
