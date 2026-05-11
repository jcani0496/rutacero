# Supabase Storage Buckets

Operational runbook for provisioning the Storage buckets used by RutaCero.
Storage buckets cannot be created via SQL migrations cleanly across local +
hosted environments, so they are provisioned via the Supabase Dashboard UI and
documented here.

## `payment-receipts`

Stores user-uploaded receipt photos / PDFs attached to a `payments` row.
The path stored in `payments.receipt_url` is the bucket-relative object key —
`${user_id}/${tenant_id}/${payment_id}.{ext}` — NOT a signed URL. The app
generates a short-lived signed URL on demand via `getReceiptSignedUrl`.

### Properties

- **Name:** `payment-receipts`
- **Visibility:** PRIVATE (NOT public). Receipts are personal financial documents.
- **Max object size:** 5 MB.
- **Allowed MIME types:**
  - `image/jpeg`
  - `image/png`
  - `image/heic`
  - `image/heif`
  - `application/pdf`

### Storage policies (storage.objects)

These are Storage policies (Dashboard → Storage → `payment-receipts` → Policies),
NOT regular table RLS. The first path segment must match the caller's `auth.uid()`,
which scopes every user to their own folder.

```sql
-- INSERT: users can upload only into their own user-id folder.
CREATE POLICY "Users upload to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: users can read only their own receipts. Service role bypasses RLS.
CREATE POLICY "Users read from own folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: no end-user delete. Receipts are kept as an audit trail.
-- Only the service role (admin/founder) can purge a receipt, e.g. for legal
-- compliance or to remove an erroneous upload. Do NOT add a user DELETE policy.
```

UPDATE is not granted either — uploads use `upsert: true` so users can re-upload
to the same path; that goes through the INSERT policy.

### Provisioning via the Supabase Dashboard

1. Open the Supabase Dashboard for the target project.
2. Go to **Storage** in the left nav, then click **New bucket**.
3. **Name:** `payment-receipts`. **Public bucket:** OFF. Click **Create bucket**.
4. Open the bucket, click **Configuration**, and set:
   - **File size limit:** `5 MB`.
   - **Allowed MIME types:** paste the five values above, one per line.
5. Click **Policies** on the bucket, choose **New policy** → **For full
   customization**, and create the INSERT and SELECT policies above. Skip
   UPDATE and DELETE.
6. Verify by signing in as a normal user in the app and uploading a test
   receipt to a real payment. Then check Storage → `payment-receipts` and
   confirm the object landed under `{user_id}/{tenant_id}/{payment_id}.jpg`.
7. Repeat steps 1–6 for every environment (local dev project, staging if any,
   and production). Local Supabase containers start with an empty Storage
   service, so the bucket must be re-created after any `supabase db reset`.
8. (Optional) After provisioning prod, snapshot the bucket configuration to
   the team password manager so it can be reproduced if the bucket is ever
   accidentally deleted.

### Android: `@capacitor/camera` install follow-up

The web upload path uses `<input type="file" capture="environment">`, which
works on Android browsers and in Capacitor's WebView. The native camera path
uses `@capacitor/camera@^8` (installed in this commit). Because adding a
Capacitor plugin requires `npx cap sync android` and Android Studio to
rebuild the native project, that sync was NOT run in CI. **Before the next
Android build, the founder must run:**

```bash
npx cap sync android
```

and then build the AAB from Android Studio as usual. Until that's done,
`Camera.getPhoto(...)` will not be wired up natively even though it is wired
up in the JS bundle.

### Local development note

`supabase start` does not auto-provision custom buckets. After `supabase start`
or `supabase db reset`, open `http://127.0.0.1:54323` (Studio) and repeat the
provisioning steps. The migration adds the `receipt_url` / `receipt_uploaded_at`
columns, but the bucket itself is out-of-band.
