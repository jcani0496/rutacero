# Storage Buckets (Railway)

Operational runbook for the object storage used by RutaCero.

## Provider

Production and local defaults use Railway Buckets (S3-compatible):

- `STORAGE_PROVIDER=railway`
- `NEXT_PUBLIC_STORAGE_PROVIDER=railway`

Configure credentials via `STORAGE_S3_*` (local) or Railway-injected `AWS_*`
vars (see `.env.example`).

Historical Supabase Storage notes live only as context in `archive/supabase/`.
Do not provision or wire Supabase Storage for this app.

## `payment-receipts`

Stores user-uploaded receipt photos / PDFs attached to a `payments` row.
The path stored in `payments.receipt_url` is the bucket-relative object key —
`${user_id}/${tenant_id}/${payment_id}.{ext}` — NOT a signed URL. The app
generates a short-lived signed URL on demand via `getReceiptSignedUrl`.

### Properties

- **Logical name:** `payment-receipts`
- **S3 API name:** globally unique (e.g. from `railway bucket credentials`)
- **Visibility:** PRIVATE (NOT public). Receipts are personal financial documents.
- **Max object size:** 5 MB.
- **Allowed MIME types:**
  - `image/jpeg`
  - `image/png`
  - `image/heic`
  - `image/heif`
  - `application/pdf`

### Provisioning (Railway)

1. Railway Dashboard → project `rutacero` → Buckets → `payment-receipts`
   (or `railway bucket` CLI).
2. Copy endpoint / access key / secret / bucket name into service variables
   (or rely on Railway auto-injection).
3. Confirm `STORAGE_PROVIDER=railway` on the web service.

### Local development

Point `STORAGE_S3_*` at the same Railway bucket credentials, or a local
S3-compatible stand-in. Without credentials, receipt upload paths that need
storage will fail closed.

## Related

- `.env.example` — `STORAGE_S3_*` / `AWS_*` fallbacks
- `src/lib` storage helpers used by payment-receipt actions
