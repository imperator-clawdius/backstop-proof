# Backstop Proof Agent Guide

## Project

Backstop Proof is a Shopify embedded app for tamper-evident packing proof and merchant-reviewed chargeback evidence packs. Keep claims factual: hash-sealed, tamper-evident, reviewable audit trail. Do not claim legal certification or guaranteed dispute wins.

## Commands

- Install: `npm install`
- Local Shopify dev: `npm run dev`
- Standalone demo dev: `npm run dev:local`
- Prisma generate: `npm run prisma generate`
- Prisma migrate deploy: `npm run setup`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm test`
- Demo smoke: `npm run smoke`
- Build: `npm run build`

## Architecture

- Shopify auth and embedded shell live in `app/shopify.server.ts` and `app/routes/app.tsx`.
- Server-only domain services live under `app/services`.
- Shared validation and pure domain logic live under `app/lib`.
- Route modules must scope all database access by authenticated shop context.
- Local storage writes to `storage/{shopDomain}/...`; production can use S3-compatible storage via env vars.
- Demo mode must be clearly labeled and must not mix with real shop data.
- Real-shop dispute demo fallback is read-only and must not create real shop records.
- Billing must use Shopify App Pricing/Billing API; do not add off-platform billing.

## Done Means

- Inputs are validated with Zod.
- Shop-owned records are queried with `shopId`.
- File and evidence downloads verify shop ownership.
- Proof uploads enforce the MIME allowlist and size limit.
- Shop data deletion removes scoped storage before database rows.
- Evidence text never invents missing tracking, delivery, policy, or communication facts.
- Dispute evidence updates stay feature-flagged and merchant-confirmed.
- `npm run typecheck`, `npm run lint`, and `npm test` pass or failures are documented with exact causes.
