# Backstop Proof Dev Store Validation

## Status

Validation date/time: 2026-07-03, America/New_York.

Current result: blocked by interactive Shopify setup. Offline verification can run from the local project, but a real Shopify development-store install cannot be completed until Shopify app credentials are provided and the Shopify CLI is linked to a Partner organization and development store.

## Local Environment

- Local project path: `%USERPROFILE%\Projects\backstop-proof`
- Node version observed: `v24.15.0`
- npm version observed: `11.12.1`
- Shopify CLI version observed through `npx shopify version`: `4.3.0`
- Database for local/dev-store validation: SQLite via `DATABASE_URL=file:dev.sqlite`
- Storage for local/dev-store validation: local disk via `STORAGE_DRIVER=local` and `LOCAL_STORAGE_DIR=./storage`
- Demo mode for real dev-store validation: disabled with `ENABLE_DEMO_MODE=false`
- Shopify dispute evidence updates: disabled with `ENABLE_SHOPIFY_DISPUTE_UPDATE=false`

## Credential Gate

The local `.env` file exists and is ignored by git. It has a generated `SESSION_SECRET` and safe local defaults, but these values are still missing:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`

Do not print or commit these values. Fill them from the Shopify Partner Dashboard after creating/linking the Backstop Proof app, or let Shopify CLI populate them if the scaffold command supports it.

## Required Shopify CLI Steps

Run from PowerShell:

```powershell
Set-Location "$env:USERPROFILE\Projects\backstop-proof"
npm run config:link
npm run dev
```

During the interactive prompts:

1. Log in to the Shopify account tied to the Partner organization.
2. Select the Partner organization.
3. Select or create the Backstop Proof app.
4. Select the Shopify development store.
5. Confirm embedded app mode.
6. Copy the HTTPS tunnel URL shown by Shopify CLI.
7. Confirm the app URL and redirect URLs in the Partner Dashboard match the scaffold callback routes.

Expected callback/auth paths in this scaffold:

- `/auth`
- `/auth/callback`

If the Partner Dashboard asks for full URLs, use the current HTTPS app URL from Shopify CLI plus those paths.

## Requested Scopes

Current configured scopes:

```text
read_orders,read_customers,read_shopify_payments_disputes,read_shopify_payments_dispute_evidences,write_shopify_payments_dispute_evidences
```

For first real-order validation, dispute write behavior should remain disabled with `ENABLE_SHOPIFY_DISPUTE_UPDATE=false`.

Protected customer data may be required for full customer name, email, and address evidence fields. If Shopify redacts or blocks these fields, the app should still generate evidence PDFs with available order, line item, fulfillment, tracking, and proof data.

## Install Checklist

After `npm run dev` starts successfully:

1. Open the install URL provided by Shopify CLI.
2. Confirm the requested scopes are expected.
3. Install Backstop Proof on the selected development store.
4. Confirm the embedded app loads in Shopify Admin.
5. Confirm refresh works inside the embedded app.
6. Confirm navigation works for:
   - `/app`
   - `/app/orders`
   - `/app/capture`
   - `/app/disputes`
   - `/app/settings`
   - `/app/help`

## Real Test Order Checklist

If no real order exists in the development store:

1. Create a test product named `Backstop Proof Test Product`.
2. Set SKU `BP-TEST-001`.
3. Create a draft order or test checkout order.
4. Add one or more line items.
5. Add a safe test shipping address.
6. Add a test customer name and email if protected customer data settings allow it.
7. Mark the order paid with a test or manual payment method.
8. Fulfill or partially fulfill the order.
9. Add a test tracking number if possible.
10. Save the order and record the order name.

## Real Order Validation Checklist

Complete these checks after install:

- `/app/orders` lists or finds the real order.
- Search by order name/number works.
- Order detail loads real Shopify data.
- No demo order data appears in real-shop mode.
- Missing protected customer data is shown as unavailable/redacted, not as a crash.

## Real Proof Capture Checklist

For the real order:

- Create a proof capture.
- Upload at least two safe JPEG, PNG, or WebP files.
- Confirm SHA-256 hashes are shown after upload.
- Confirm proof files list MIME type, byte size, captured timestamp, and hash.
- Seal the proof.
- Confirm sealed proof cannot receive destructive edits.

## Real Evidence PDF Checklist

Generate the evidence pack from the sealed proof and record:

- Evidence pack ID: not yet available.
- Completeness score: not yet available.
- PDF file size: not yet available.
- PDF opens: not yet validated.
- Demo contamination: not yet validated against a real store.

The PDF must contain:

- Backstop Proof name.
- Evidence pack ID.
- Generated timestamp.
- Shop name/domain.
- Real Shopify order name.
- Line items.
- Total/currency if available.
- Fulfillment/tracking fields if available.
- Proof filenames.
- SHA-256 hashes.
- Audit trail.
- Rebuttal text.
- Disclaimer: `Backstop Proof prepares merchant-reviewed evidence materials. It does not provide legal advice and does not guarantee dispute outcomes.`

The PDF must not contain demo order, demo dispute, or demo proof data.

## Dispute API Validation

Open `/app/disputes` in real-shop mode.

If Shopify Payments dispute access is unavailable, expected behavior is:

- No 500 response.
- A merchant-readable banner explains that dispute access is unavailable.
- Manual evidence packs still work from order data.
- Demo dispute fallback is read-only and does not write demo records into the real shop.

If dispute access is available:

- List disputes.
- Open a dispute detail page.
- Confirm associated order lookup.
- Keep `ENABLE_SHOPIFY_DISPUTE_UPDATE=false` unless explicitly testing draft updates.
- Do not auto-submit evidence.

## Common Install Failure Checks

- App URL mismatch between Shopify CLI tunnel and Partner Dashboard.
- Missing `SHOPIFY_API_KEY` or `SHOPIFY_API_SECRET`.
- Blank or weak `SESSION_SECRET`.
- Redirect URL missing `/auth/callback`.
- Invalid or unavailable dispute scopes.
- Protected customer data not approved for fields used by evidence packs.
- Local database migrations not applied.
- Tunnel URL changed after restarting `npm run dev`.

## Current Result

- App linked: no, blocked by interactive Shopify setup.
- Dev server with Shopify CLI: not started, blocked by missing Shopify app credentials and interactive login/store selection.
- Tunnel URL: not created.
- Install succeeded: not yet.
- Embedded app loaded: not yet.
- Real order loaded: not yet.
- Real proof captured: not yet.
- Real evidence PDF generated: not yet.
- Dispute API behavior: not yet validated against real store.

## Ready For Next Gate

The repository is ready for Shopify dev-store installation attempts after `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are filled and Shopify CLI linking is completed.
