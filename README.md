# Backstop Proof

Backstop Proof is a Shopify embedded app for physical-product merchants who need tamper-evident packing proof and bank-ready chargeback evidence packs. It helps merchants capture packing photos before shipment, seal proof files with SHA-256 hashes, keep an audit trail, and generate merchant-reviewed PDF evidence packs from Shopify order data.

Backstop Proof does not provide legal advice and does not guarantee dispute outcomes.

## Local Setup

Use Node.js 22.15 or newer on the 22.x line, or Node.js 24+. CI verifies Node 22
and 24 with the committed npm lockfile; the production image uses Node 22.

Do not run or keep the project under `C:\Windows\system32`. Use a normal user-owned projects directory.

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\Projects" | Out-Null
Set-Location "$env:USERPROFILE\Projects"
# Clone or copy this repository into .\backstop-proof, then:
Set-Location "$env:USERPROFILE\Projects\backstop-proof"
npm install
Copy-Item .env.example .env
npm run prisma -- generate
npm run prisma -- migrate dev
npm run dev:local
```

`npm run dev:local` starts the app in standalone demo mode with `SHOPIFY_API_KEY=demo`. Use `npm run dev` for Shopify CLI embedded development.

## Shopify Partner Setup

Windows PowerShell:

```powershell
Set-Location "$env:USERPROFILE\Projects\backstop-proof"
Copy-Item .env.example .env
npm install
npm run prisma -- generate
npm run prisma -- migrate dev
npm run config:link
npm run dev
```

Then complete the interactive Shopify CLI prompts:

1. Select the Partner organization and development store.
2. Create or link the Backstop Proof app.
3. Use the HTTPS tunnel URL from `shopify app dev` as the app URL.
4. Keep embedded app mode enabled.
5. Configure scopes:
   `read_orders,read_customers,read_shopify_payments_disputes,read_shopify_payments_dispute_evidences,write_shopify_payments_dispute_evidences`
6. Configure webhooks:
   `/webhooks/app/uninstalled` and `/webhooks/app/scopes_update`
7. Install on a Shopify development store.

Shopify Payments dispute scopes and dispute data may be unavailable on some development stores. The app degrades to order search, proof capture, manual evidence PDFs, and read-only demo dispute fallback.

## Dev Store Validation Workflow

The full checklist lives in `docs/dev-store-validation.md`. Minimum real-order validation:

1. Fill `.env` with `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, a current `SHOPIFY_APP_URL`, `ENABLE_DEMO_MODE=false`, and `ENABLE_SHOPIFY_DISPUTE_UPDATE=false`.
2. Run `npm run config:link` and select the Partner organization, Backstop Proof app, and development store.
3. Run `npm run dev` and use the HTTPS tunnel URL provided by Shopify CLI.
4. Confirm the Partner Dashboard app URL and redirect URL include the tunnel URL and `/auth/callback`.
5. Install the embedded app on the development store.
6. Create or select a real Shopify order with physical line items.
7. Open `/app/orders`, find the real order, and verify no demo data appears.
8. Create a proof capture, upload at least two JPEG/PNG/WebP proof files, and seal it.
9. Generate and download an evidence PDF.
10. Confirm the PDF contains real order facts and proof hashes, and no demo order, demo dispute, or demo proof data.

If protected customer data access is not approved, customer names, emails, or addresses may be unavailable. The app should show missing/unavailable labels and still generate evidence from order, line item, fulfillment, tracking, and proof data.

Common Shopify install failures:

- App URL or tunnel URL mismatch.
- Missing `SHOPIFY_API_KEY` or `SHOPIFY_API_SECRET`.
- Redirect URL missing `/auth/callback`.
- Tunnel URL changed after restarting `npm run dev`.
- Invalid or unavailable dispute scopes.
- Protected customer data not approved.
- Local migrations not applied.

## Environment

Copy `.env.example` to `.env` and fill Shopify keys. `.env.example` intentionally contains placeholders only. `DATABASE_URL` is required for migrations and application database access. The example `file:dev.sqlite` selects `prisma/dev.sqlite`, relative to the Prisma schema. An absolute SQLite URL, such as `file:/data/backstop.sqlite`, selects that file for both migrations and the generated application client. Preserve or explicitly move existing data before changing this location; changing the URL does not copy a database.

SQLite remains the configured Prisma provider. For production PostgreSQL, update the datasource provider and `DATABASE_URL`, then create and verify a production migration before launch. Changing only the URL does not switch providers.

Storage defaults to local disk at `./storage`. For production, set `STORAGE_DRIVER=s3` and the S3-compatible variables.

Proof uploads are limited to 25 MB each. Accepted merchant upload MIME types are `image/jpeg`, `image/png`, `image/webp`, and `application/pdf`. Executable, script, HTML, SVG, and video uploads are rejected.

## Commands

- `npm run dev`: Shopify CLI dev server with tunnel and embedded app install flow.
- `npm run dev:local`: standalone demo server without real Shopify dispute access.
- `npm run setup`: `prisma generate && prisma migrate deploy`.
- `npm run typecheck`: React Router typegen and TypeScript check.
- `npm run lint`: ESLint.
- `npm run test:database`: migrate two temporary SQLite databases and verify application writes, independent-process reads, and isolation at the configured locations. It uses fictional rows and removes its own temporary files.
- `npm test`: Vitest unit and integration tests.
- `npm run smoke`: demo evidence flow smoke test.
- `npm run build`: production build.

## GraphQL tooling

`npm run graphql-codegen` generates `app/types/admin.types.d.ts` and
`app/types/admin.generated.d.ts` for the July 2026 Admin API. It uses Shopify's
standalone preset and pluck hooks with GraphQL Code Generator's programmatic
core, preserving interpolated `#graphql` fragments and Admin client typing.
`npm run test:graphql` checks this tooling with fictional schemas and no network.

The dependency-free `.graphqlrc.cjs` keeps the same schema/document projects
available to GraphQL editors. The default project includes `app/.server`.
Extension directories containing `schema.graphql` remain discoverable by editors;
they have no configured generation target. The runner supports no arguments,
`--project default`, and `--help`; other CLI options are rejected. Source links
(including directory junctions) are unsupported and cause a clear error.

An existing `app/types/admin-2026-07.schema.json` is preferred. Only when it is
absent does generation retrieve the fixed public Shopify schema, without merchant
credentials, with a 25-second request/body deadline and an 8 MiB limit. Redirects
and retries are disabled. Invalid documents fail before changing generated files.
The output files are written separately, so interruption during writes is not a
transaction across all files. Generated types do not establish store access or
permission to execute an operation.

## Demo Mode

Standalone demo mode is enabled only when `ENABLE_DEMO_MODE=true` and `SHOPIFY_API_KEY=demo`. Query parameters and request headers do not bypass Shopify authentication. Use `/api/demo/reset` with POST while running standalone demo mode to seed a sealed demo proof capture and a generated evidence PDF.

When a real authenticated store cannot access Shopify Payments dispute APIs, the disputes page can show a read-only demo dispute fallback if `ENABLE_DEMO_MODE=true`. That fallback does not create evidence packs, update Shopify evidence, or write demo dispute records into the real shop.

## Billing

Public App Store distribution must use Shopify App Pricing/Billing API. MVP pricing copy:

- Free: 10 proof captures/month, 1 evidence PDF/month, watermark footer.
- Starter: $19/month, 100 proof captures/month, 20 evidence PDFs/month.
- Pro: $59/month, 1,000 proof captures/month, 100 evidence PDFs/month, due-date reminders.
- Future usage add-on: $0.50 per extra evidence PDF or proof pack through Shopify usage billing.

No Stripe or off-platform billing is implemented.

## Deployment

Deploy as a Node app on Render, Fly, Railway, or Vercel-compatible Node hosting that supports long-running server routes and Prisma. Production needs:

- HTTPS `SHOPIFY_APP_URL`
- PostgreSQL `DATABASE_URL` and a production Prisma schema/migration
- S3-compatible storage
- secure `SESSION_SECRET`
- Shopify app scopes and webhooks released in the Dev Dashboard
- `ENABLE_DEMO_MODE=false`
- `ENABLE_SHOPIFY_DISPUTE_UPDATE=true` only after validating dispute permissions
- Shopify App Pricing/Billing API before public App Store distribution
- legal review of the templates in `docs/legal`
- production logging that avoids full customer addresses and unnecessary PII
- object lifecycle and retention policy aligned to merchant settings

## App Store Checklist

- Listing copy: `docs/app-store/listing.md`
- Legal templates: `docs/legal`
- Security summary: `docs/legal/security.md`
- Dev-store validation record: `docs/dev-store-validation.md`
- Production readiness gaps: `docs/production-readiness.md`
- Roadmap: `docs/roadmap.md`
- Screenshots to capture from a dev store: dashboard, order search, capture workflow, sealed proof, evidence pack detail, dispute fallback/demo, settings.

## Known Limitations

- Shopify Payments dispute evidence updates are feature-flagged and draft-only.
- Final dispute submission is not automated.
- Carrier delivery events are limited to Shopify order data in MVP.
- Email sending is represented by internal notification records unless SMTP is configured in a later deployment.
- Local SQLite is for development; production should use PostgreSQL.
- `npm audit --omit=dev` reports 0 production vulnerabilities as of July 3, 2026. Full `npm audit` reports dev-only transitive vulnerabilities in Vitest/Vite, Shopify GraphQL codegen, and ESLint tooling; available fixes require breaking major upgrades and should be handled in a dependency maintenance pass.
