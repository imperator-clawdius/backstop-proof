# Backstop Proof Production Readiness

## Status

Backstop Proof is not production or Shopify App Store ready yet. It is on the path toward development-store validation once Shopify credentials and interactive CLI setup are completed.

## Production Blockers

- Configure PostgreSQL for production and create production-safe Prisma migrations.
- Configure S3-compatible object storage and validate scoped deletion.
- Deploy to durable HTTPS Node hosting.
- Configure Shopify App Pricing or Shopify Billing API.
- Request protected customer data access if customer names, emails, or addresses are required in App Store distribution.
- Complete legal review of privacy policy and terms templates.
- Verify app uninstall webhook delivery in production.
- Define backup, retention, and restore policy.
- Resolve or document dev-only dependency vulnerabilities.
- Complete real development-store validation with at least one real order and evidence PDF.
- Capture final App Store listing screenshots from a real embedded Shopify install.

## Production Non-Blockers For Dev-Store Validation

- Real Shopify Payments dispute API availability.
- Managed chargeback submission.
- AI review.
- Stripe dispute integration.
- PayPal dispute integration.
- Warehouse team accounts.
- Public verification links.
- Verifi or Ethoca alert integrations.

## App Store Not-Ready Conditions

- No Shopify billing integration has been implemented or validated.
- Legal templates have not been reviewed by counsel.
- Production database and storage are not configured.
- Protected customer data approval is not confirmed.
- Production hosting URL is not configured.
- Final listing assets and screenshots are not captured.
- Real development-store evidence PDF has not yet been produced.

## Security Checklist

- Shop-owned records must stay scoped by `shopId`.
- Proof file downloads must require authenticated shop ownership.
- Evidence PDF downloads must require authenticated shop ownership.
- Demo reset must remain unavailable to real shop contexts.
- Demo auth bypass must require both `ENABLE_DEMO_MODE=true` and `SHOPIFY_API_KEY=demo`.
- Real-shop demo dispute fallback must remain read-only.
- Uploaded files must enforce MIME type and size limits.
- SVG, HTML, script, executable, shell, and video uploads must remain rejected.
- Sealed proof captures must remain immutable except for appended audit events.
- Rebuttal templates must not invent missing facts.

## Dependency Status

`npm audit --omit=dev` is the production dependency gate. Full `npm audit` may report dev-only findings in local tooling. Do not run `npm audit fix --force` against the Shopify scaffold without a separate dependency maintenance plan.

Known dev-only areas from the current audit:

- Vitest/Vite/esbuild development server chain.
- Shopify GraphQL codegen transitive lodash chain.
- ESLint TypeScript parser transitive minimatch chain.

These are not production runtime dependencies for the deployed app, but they should be addressed before public release through a controlled upgrade pass.

## Production Prep Gate

The next production-prep gate should not begin until the Shopify development-store validation produces a real-order evidence PDF and records:

- Shopify development store domain, partially redacted.
- Real order identifier.
- Evidence pack ID.
- Completeness score.
- PDF byte size.
- Dispute API behavior.
- Any protected customer data limitations.
