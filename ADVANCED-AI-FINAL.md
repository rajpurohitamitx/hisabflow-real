# Hisab Flow — Advanced AI Final Layer

This release adds the advanced intelligence foundation requested for the God Mode build.

## Included

- Heuristic sales forecasting with trend, weekday seasonality and confidence band.
- Transaction anomaly detection for unusual sales, expenses, collections and duplicate payment patterns.
- Proactive recommendations grounded in live business records.
- Adaptive business-memory learning for product units, reorder points and business profile facts.
- Advanced tenant-scoped entity resolution with aliases, ranking, ambiguity detection and resolution audit events.
- Industry workflow planner for daily opening, daily closing, collection sweep and stock review.
- Safe AI Copilot planning endpoint. The planner can generate action plans but does not directly execute money-moving actions.
- Persistent AI insight, entity-resolution and workflow-run records.
- AI Insights UI.
- AI conversation history is retained and passed as context metadata for multi-turn interpretation.

## Safety model

AI interprets and plans. Deterministic application services validate and execute financial mutations. High-risk financial actions remain confirmation-gated.

## Production verification

A static architecture validation script is included:

`npm run validate:architecture`

Full dependency installation, Prisma generation/migration, Next.js production build, browser testing and provider-backed AI tests still require a network-enabled environment with the actual environment variables and database credentials. The development environment used to assemble this archive timed out during `npm install`, so a successful production build is not claimed here.
