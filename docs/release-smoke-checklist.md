# Release Smoke Checklist

Use this after changes that touch acquisition, onboarding, billing, or GTM reporting.

## Local Preflight

- Run `npm run verify:smoke:local` before QA smoke.
- Preferred local setup: enable `RECURRENTE_MOCK_MODE=true` and set a local `RECURRENTE_WEBHOOK_SECRET` (32+ chars) in `.env.local`. This lets checkout smoke run without real Recurrente dashboard keys.
- If you want to hit the real gateway instead of mock mode, populate `.env.local` with sandbox values for `RECURRENTE_PUBLIC_KEY` or `RECURRENTE_API_KEY`, `RECURRENTE_SECRET_KEY`, and `RECURRENTE_WEBHOOK_SECRET`.
- If it fails on missing tables, run `npm run db:push:local` or reset local Supabase before retrying smoke.

## Funnel Path

- Open `/` with a tagged URL and confirm attribution is captured through signup and pricing.
- Complete signup and verify the first authenticated path lands in onboarding without auth or tenant errors.
- Finish onboarding, add at least one debt, and generate the first plan.
- Open checkout and confirm the billing session is created without duplicate-subscription errors.

## Payment Lifecycle

- Simulate a successful Recurrente checkout or webhook and confirm the tenant subscription becomes `ACTIVE`.
- Simulate a failed payment webhook and confirm the subscription becomes `PAST_DUE` and recovery automation is queued.
- Simulate a recovery payment webhook and confirm the subscription returns to `ACTIVE`.
- Simulate a cancellation webhook and confirm the subscription downgrades to `FREE` with `CANCELED` status.

## Admin Verification

- Open the admin analytics/reporting surface and confirm checkout, payment, recovery, and churn metrics render without query or aggregation errors.
- Spot-check the GTM scorecard export for the expected source, medium, plan strategy, and dropoff fields.
