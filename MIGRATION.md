# Migration from the original HisabFlow app

The supplied project was an Express/EJS + MongoDB/Mongoose application. This build moves the core architecture to:

```text
Express/EJS + MongoDB
        ↓
Next.js + React + TypeScript
        ↓
PostgreSQL + Prisma
```

The migration preserves the important domain concepts while making tenant isolation, relational consistency, transactions, ledgers, payment allocation, AI action history and industry configuration first-class parts of the model.

The old project can remain as a reference while this project becomes the new application.
