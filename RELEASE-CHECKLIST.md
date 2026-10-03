# Hisab Flow Release Checklist

## Automated checks
- `npm install --no-audit --no-fund`
- `npm run db:generate`
- `npm run test:architecture`
- `npm run check`
- `npm run build`
- `npm run db:deploy`
- `npm run test:db`
- `npm run test:openai`
- `npm run test:e2e`

## Required production secrets
- `DATABASE_URL`
- `SESSION_SECRET` (32+ random characters)
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY` for AI/voice provider features
- Optional WhatsApp/payment/integration credentials as those modules are enabled.

## Vercel
The repository includes `vercel-deploy.yml`. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub Actions secrets to enable automated production deployment.

Production Vercel builds run reviewed Prisma migrations before generating Prisma Client and building the Next.js application. Migrations are stored in source control and applied with `prisma migrate deploy`.

## Important
No application can truthfully guarantee zero runtime errors. This build instead uses automated type/build/database/browser checks, guarded financial transactions, validation, audit logging, graceful error boundaries, and CI/CD gates to catch errors before release and fail safely when an external service is unavailable.
