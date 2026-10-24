# HANDOFF — backstop-proof

**One-liner:** Shopify embedded app that captures tamper-evident packing proof and generates bank-ready chargeback evidence packs from Shopify order data.
**Status:** beta — ~70% to shippable
**Monetization:** Shopify App Store subscriptions (Free / Starter $19/mo / Pro $59/mo) + usage add-on (~$0.50 per extra evidence pack) via Shopify Billing API — not yet implemented.

## What it is
A Shopify embedded admin app (React Router 7 + Prisma) for physical-product merchants. Staff capture packing photos before shipment, the app seals them with SHA-256 hashes into a hash-chained audit trail, and generates merchant-reviewed PDF evidence packs from order/fulfillment/dispute data. It explicitly gives no legal advice and guarantees no dispute outcome.

## Who pays & why
Shopify merchants shipping physical goods who lose money to card/friendly-fraud chargebacks. Pain: assembling bank-ready dispute evidence is manual, slow, and deadline-bound. Willingness to pay: $19–$59/mo is low vs. a single recovered chargeback.

## Stack
TypeScript, React Router 7 (Remix-style SSR), React 18, Shopify App Bridge + Polaris, Prisma ORM (SQLite dev / PostgreSQL prod), pdf-lib (PDF gen), AWS S3 SDK (or local disk) storage, Zod. Vitest + ESLint. Multi-stage Dockerfile (Node 22 alpine). GitHub Actions CI on Node 22/24.

## Architecture
Input → processing → output: Shopify order (GraphQL Admin API) + merchant proof uploads → seal with SHA-256, score completeness, build rebuttal → PDF evidence pack + optional draft dispute-evidence submission.
- `app/services/` — `pdf.server.ts` (283 lines, PDF build), `evidence.server.ts`, `proof.server.ts`, `storage.server.ts` (S3/local), `shopify-graphql.server.ts`, `dispute-evidence.server.ts`, `audit.server.ts`
- `app/lib/` — `proof-integrity.ts`, `evidence-score.ts`, `rebuttal.ts`, `upload-validation.ts`
- `app/routes/` — `app.orders`, `app.capture`, `app.disputes`, `app.evidence`, `app.settings`, `webhooks.*`
- `prisma/schema.prisma` — Shop, ProofCapture, ProofFile, EvidencePack, DisputeSnapshot, AuditEvent, Notification

## What works today
- Full Prisma data model + Shopify OAuth / embedded install + session storage
- Proof capture & upload (JPEG/PNG/WebP/PDF, 25 MB cap, MIME enforcement), SHA-256 sealing, hash-chained audit trail
- Evidence PDF generation with completeness score, missing-items list, and generated rebuttal text
- S3-compatible or local-disk storage; shop-scoped download authorization
- Order search, dispute snapshot pages, settings, notifications; standalone demo mode
- Comprehensive CI (typecheck, lint, Vitest, prisma validate, SQLite persistence test, Docker build) — green

## Gaps to ship (ranked)
1. No billing implemented — Shopify Billing API plan/usage enforcement must be built (README: "No Stripe or off-platform billing is implemented").
2. No real dev-store validation yet — needs Shopify Partner credentials, a real order → evidence PDF run, and protected-customer-data approval for PII.
3. Production hardening — migrate SQLite → PostgreSQL with prod migrations, provision S3 + HTTPS host + SESSION_SECRET; dispute submission is feature-flagged/draft-only (`ENABLE_SHOPIFY_DISPUTE_UPDATE`), final submission not automated; legal templates need counsel review.

## Run it
```bash
npm install
cp .env.example .env
npm run prisma -- generate
npm run prisma -- migrate dev
npm run dev:local          # standalone demo mode (SHOPIFY_API_KEY=demo)
# OR embedded dev against a real store:
npm run config:link && npm run dev
```

## Risks / unknowns
- Shopify Payments dispute scopes are unavailable on many dev stores; app degrades to manual evidence only.
- Protected customer data approval required before customer PII can appear in an App Store build.
- Positioned as evidence tooling, not legal advice / no outcome guarantee — keep that boundary.
- Full `npm audit` flags dev-only transitive vulns (Vitest/Vite/codegen) needing a major-upgrade pass.

## Fastest path to revenue
1. Implement Shopify Billing API (Free/$19/$59 tiers + usage records) and gate features by plan.
2. Complete dev-store validation with one real order + evidence PDF; request protected-customer-data access.
3. Provision PostgreSQL + S3 + HTTPS hosting; submit to the Shopify App Store with legal-reviewed templates.
