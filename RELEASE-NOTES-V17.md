# Hisab Flow V17 — Semantic Conversation Engine

V17 focuses on semantic coverage and conversation correctness rather than adding new UI features.

## Added
- Versioned semantic training/few-shot corpus in `lib/ai/training-data.ts`.
- Examples for payments, sales, purchases, reminders, balances, statements, outstanding customers, supplier dues, stock, profit, analysis, dates, multilingual/code-mixed phrasing and conversational CRUD.
- Deterministic ordinal candidate selection (`1st`, `2nd`, `first one`, etc.) for pending customer/product choices.
- Structured last-result context for follow-up questions such as `show their names and balance`.
- Date-aware `SALES_ON_DATE` execution for yesterday and explicit calendar dates.
- Detailed outstanding-customer responses with names and amounts.
- Safer confirmation: `yes` cannot execute a pending action that is still waiting for unresolved customer/product input.
- Pending create-customer confirmation can continue through the same action instead of being reinterpreted as a new command.

## Important
This corpus is semantic few-shot/reference data, not model-weight training. The provider model is still Gemini/OpenAI/local AI. The application combines the corpus with live business data, deterministic rules and the accounting engine.
