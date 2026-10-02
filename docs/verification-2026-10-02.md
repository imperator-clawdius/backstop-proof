# Evidence-generation repair review — October 2, 2026

Baseline: `36cff4a`. The original checkout is preserved; repairs use an isolated
`codex/backstop-delivery-review` branch.

## Confirmed defects and changes

Five new service regression cases failed before repair. Concurrent evidence packs
could overwrite the same timestamp-named file; the ID printed in the PDF differed
from the database/download ID. A requested proof that was missing or owned by
another shop silently disappeared, and an unavailable or wrong-order dispute could
be attached. Generation now chooses one UUID for the database, PDF and storage
path, and rejects invalid explicit selections before writing files or records.
Manual packs without a dispute or proof remain supported; valid matched selections
remain attached. Tests mock provider/storage/database boundaries, rather than
claiming Shopify installation or production storage verification.

Three additional regressions reproduced unsupported generated claims of successful
payment, completed shipment, and proof captured before shipment. The generated text
now describes available records. Only a successful SALE/CAPTURE supplies the payment
timeline date, and fulfillment creation is labeled as a record timestamp. Positive
coverage retains successful capture after refund/failed transaction records.

PDF generation now embeds one licensed, unmodified static Zen Kaku Gothic New
font, wraps unbroken URLs on grapheme boundaries and paginates long rows with
continuation labels. MuPDF rendering and extraction verified Japanese merchant,
customer and item text, accented Latin, and all 4,249 tracking-URL characters across
three pages. Actual rendered text stayed within the page margins. Full embedding
avoids missing glyph outlines reproduced with fontkit subsetting; it adds about
1.5 MB per PDF. The font source, hash and license are bundled in `public/fonts`.
This is bounded language coverage, not universal Unicode or bidirectional layout.
Unsupported visible characters fail explicitly instead of disappearing.

Independent review also reproduced pasted tab-separated text failing export.
Tabs now expand to four layout spaces, with original stored text unchanged. Its
regression failed before repair and passes with the unsupported-character guard.

## Dependencies and verification infrastructure

- Full dependency audit initially reported 39 findings; runtime-only audit reported
  18. Updated dependency resolution reports zero findings.
- React Router stays on the Shopify adapter's supported 7.x line at 7.18.4. Vitest
  moves to 4.1.11 and the TypeScript ESLint pair to 8.60.1.
- Prisma/client remain 6.19.3. A scoped `@prisma/config` override uses deepmerge-ts
  8.0.2; the named `deepmerge` API used by Prisma is retained. Reviewed changes to
  Map/custom/Into merging do not affect this application's plain configuration.
  A scoped codegen helper override uses lodash 4.18.1. No forced dependency
  downgrade, legacy peer-resolution mode, or audit suppression is used.
- Updated tooling requires Node 22.15+ on 22.x or Node 24+. CI uses the committed
  npm lockfile on Node 22/24 and now runs the actual unit/demo integration suite,
  Prisma generation/validation, types, lint, build, and full audit.
- The copied Shopify template CLA, Slack/Gardener, and JavaScript-template branch
  workflows are removed. Ownership/contribution instructions refer to this app.
  The old CLA workflow can still fail the first PR from the unchanged default
  branch because it uses `pull_request_target`; it is not an application test.
- Docker builds with development tools before pruning, copies built application,
  public fonts, Prisma schema/migrations/client into runtime, and excludes local
  credentials, databases and proof storage from build context. A hosted Docker
  image build runs in the Node 22 job; Docker is unavailable on this Windows host.

Prisma generate/validate and the final combined 46 tests, application/route types,
lint and production build pass. Full dependency audit reports zero findings.
The hosted Docker result remains to be recorded after PR creation.

The intended local compiled HTTP/download smoke was not run: automatic approval
review rejected server startup, including a narrower attempt without migrations,
with the reason "blocked by policy". No production database was targeted. Actual
PDF generation/rendering and mocked service-boundary coverage do not replace a
real Shopify install or end-to-end production download check.

## Commercial state

The repo still has a blank Shopify client ID and placeholder application URL.
No authenticated development-store install, real-order PDF, production database,
object storage, public application hosting or app billing is verified.

For this new public app's documented recurring plans, use
[Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing)
and configure plans in the Partner Dashboard. Subscription/entitlement integration
and real development-store validation remain implementation/setup work. No new
Manual Billing API or off-platform checkout has been added.

All generated data and PDFs used here are fictional fixtures. No merchant/customer
records, provider mutations, messages, payments, production migrations, or App Store
submission were performed.
