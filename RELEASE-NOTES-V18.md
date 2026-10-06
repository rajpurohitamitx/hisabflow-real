# Hisab Flow V18 — GOD-Level Semantic AI Corpus Integration

## What changed

V18 integrates the **Hisab Flow GOD-Level Semantic Conversation Dataset v1** and its machine-readable manifest into the runtime AI interpretation layer.

### Added semantic corpus
- `data/ai/GOD-LEVEL-SEMANTIC-CONVERSATION-DATASET-v1.md`
- `data/ai/GOD-LEVEL-SEMANTIC-DATASET-MANIFEST-v1.json`
- `data/ai/GOD-LEVEL-SEMANTIC-CORPUS-v1.json`
- `lib/ai/god-level-training.ts`

### Runtime AI integration
`lib/ai/training-data.ts` now injects:
- existing Hisab semantic examples
- GOD-level business families
- critical safety/conversation invariants
- a large set of real-world semantic examples

The model is instructed to use these as **meaning examples**, not literal phrase-to-function rules.

## Important clarification
This is **runtime semantic/few-shot training**, not modification of model weights. The OpenAI/Gemini base model is not retrained by this ZIP alone. The application now supplies the corpus to the interpreter prompt and keeps the complete corpus in-repo for regression/evaluation and future provider fine-tuning if desired.

## Business-analysis behavior reinforced
Hisab should distinguish:
- FACT vs INTERPRETATION vs RECOMMENDATION vs ACTION
- sales growth vs profit growth
- customer/product/supplier/root-cause analysis
- evidence-backed recommendations
- forecasts as estimates, never guarantees
- read-only analysis from financial mutations
- recommendations that do not execute automatically

## Safety behavior reinforced
- explicit current entity overrides stale context
- mismatched entity name + ID is rejected
- payment is not sale
- read-only requests do not require confirmation
- `yes` confirms only the current pending action
- confirmation is idempotent
- corrections patch pending actions
- no invented amounts/prices
- no destructive accounting-history deletion
- analytics grounded in records
- unrelated context is isolated

## Validation
The ZIP is integrity-checked after packaging. A full TypeScript/Next build still requires installing project dependencies in an environment with network/package access; this runtime does not have the project's `node_modules` installed.
