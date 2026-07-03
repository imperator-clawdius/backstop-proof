# Security Summary

This document is a technical summary and not legal advice.

## Authentication

Backstop Proof uses Shopify embedded app session authentication through the Shopify React Router app package. Demo mode is explicitly labeled and enabled only by environment configuration.

## Shop Isolation

Database queries use `shopId` from the authenticated shop context. File and evidence download endpoints verify shop ownership before reading storage objects.

Demo dispute fallback is read-only for authenticated real shops. Standalone demo mode is available only when `ENABLE_DEMO_MODE=true` and `SHOPIFY_API_KEY=demo`.

## File Integrity

Uploaded files are hashed server-side with SHA-256 and stored with MIME type, byte size, timestamp, shop ID, order ID, and proof capture ID. Evidence packs state that changing the underlying file changes the hash.

Merchant proof uploads are limited to 25 MB and allowed MIME types are `image/jpeg`, `image/png`, `image/webp`, and `application/pdf`. Executable, script, HTML, SVG, and video uploads are rejected.

## Storage

Development storage writes to `storage/{shopDomain}/...`. Production storage supports S3-compatible object storage. Files are not public by default; app routes provide authenticated downloads. Shop data deletion and uninstall cleanup remove the scoped storage namespace before deleting database records.

## Logging

Production logs should avoid full customer addresses and unnecessary PII. Webhooks log topic and shop only.

## Data Deletion

Settings include a shop data delete action. The app uninstall webhook deletes shop storage, sessions, shop records, and cascades associated proof, evidence, dispute snapshot, audit, and notification data.
