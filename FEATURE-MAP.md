# Hisab Flow Feature Map

Status meanings: **CORE** = implemented in this build, **FOUNDATION** = schema/service boundary exists, **PLANNED** = needs external provider or additional UI/worker work.

| System | Capability | Status |
|---|---|---|
| AI | Natural language intent parsing | CORE |
| AI | Entity resolution | CORE |
| AI | Conversation context | CORE |
| AI | Business memory | CORE |
| AI | Confirmation/risk gate | CORE |
| AI | AI action history | CORE |
| AI | Voice browser input | FOUNDATION |
| AI | Multilingual hosted-model interpretation | CORE when provider configured |
| AI | Correction learning | PLANNED |
| Accounting | Customer receivables ledger | CORE |
| Accounting | Supplier payables ledger foundation | CORE |
| Accounting | Sales | CORE |
| Accounting | Purchases | CORE |
| Accounting | Payments | CORE |
| Accounting | Payment allocation | CORE |
| Accounting | Partial payments | CORE |
| Accounting | Advances | CORE |
| Accounting | Expenses | CORE |
| Accounting | Reversal/adjustment framework | FOUNDATION |
| Billing | Invoice numbering | CORE |
| Billing | GST rate fields | CORE |
| Billing | Quotes/estimates/proforma | PLANNED |
| Billing | Credit notes/refunds | PLANNED |
| Inventory | Products/SKU/barcode | CORE |
| Inventory | Stock movement | CORE |
| Inventory | Reorder point | CORE |
| Inventory | Stock valuation | CORE |
| Inventory | Batch/expiry/serial flags | FOUNDATION |
| Inventory | Warehouses | FOUNDATION |
| CRM | Customer profile | CORE |
| CRM | Customer timeline | CORE |
| CRM | Customer balance | CORE |
| CRM | Reminders | CORE |
| Suppliers | Supplier profiles | CORE |
| Suppliers | Supplier purchase history | FOUNDATION |
| AI Brain | Sales questions | CORE |
| AI Brain | Customer balance questions | CORE |
| AI Brain | Low-stock questions | CORE |
| AI Brain | Daily briefing | CORE |
| AI Brain | Explain/Why engine | FOUNDATION |
| AI Brain | Forecasting | PLANNED |
| Documents | Document model | FOUNDATION |
| Documents | OCR extraction | PLANNED |
| Migration | Import pipeline model | FOUNDATION |
| Migration | Tally/CSV/Excel adapters | PLANNED |
| Automation | Reminders | FOUNDATION/CORE API |
| Automation | Scheduled reports | PLANNED |
| Employees | Roles | CORE |
| Employees | Permission foundation | CORE |
| Employees | Approval workflows | FOUNDATION |
| Audit | Audit log | CORE |
| Audit | AI provenance | CORE |
| Security | Business/tenant isolation | CORE |
| Security | Password hashing | CORE |
| Security | Session cookies | CORE |
| Reporting | Dashboard metrics | CORE |
| Reporting | Summary endpoint | CORE |
| Reporting | Drill-down report suite | PLANNED |
| Multi-branch | Branch model | FOUNDATION |
| Multi-branch | Warehouse model | FOUNDATION |
| WhatsApp | Same AI/business-engine boundary | FOUNDATION |
| WhatsApp | Business API connector | PLANNED |
| Offline | Data model compatible | FOUNDATION |
| Offline | Sync/conflict worker | PLANNED |
| Integrations | Payment gateways | PLANNED |
| Integrations | Banking | PLANNED |
| Integrations | E-commerce | PLANNED |
| Integrations | Tally/Zoho/Vyapar | PLANNED |
| Industry | Retail/Kirana config | FOUNDATION |
| Industry | Wholesale config | FOUNDATION |
| Industry | Jewellery/Silver config | FOUNDATION |
| Industry | Future vertical engine | FOUNDATION |

The key point is intentional: no unavailable external service is represented as a fake completed integration.
