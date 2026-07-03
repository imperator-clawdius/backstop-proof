# Privacy Policy Template

This template is not legal advice and requires legal review before public use.

## Data Collected

Backstop Proof processes Shopify shop identifiers, order identifiers, order names, customer names and emails when available, shipping and billing addresses when available, line items, fulfillment and tracking data, dispute metadata when permissions allow, uploaded proof files, SHA-256 hashes, audit events, app settings, and internal notifications.

## Purpose

Data is processed to help merchants capture packing proof, generate evidence packs, prepare merchant-reviewed dispute response materials, and maintain an audit trail.

## Data Retention

Merchants can configure retention to 90, 180, or 365 days. Production deployments should implement scheduled deletion according to the selected retention period.

## Deletion Requests

Merchants can delete shop proof, evidence, dispute snapshots, audit events, and notifications from Settings. App uninstall webhook handling deletes shop records and associated app data.

## Legal Advice and Outcomes

Backstop Proof does not provide legal advice and does not guarantee dispute outcomes.

## Storage and Security

Files are stored in local development storage or configured S3-compatible production storage. Downloads are served through authenticated app routes. Proof files are hashed with SHA-256.
