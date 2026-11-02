# Commercial operations checklist

## Subscription order workflow

1. A centre submits a request from the public pricing page. The request is stored as `pending`; no payment is collected.
2. The Super Admin contacts the centre by WhatsApp or e-mail and records the discussion in the internal notes.
3. The Super Admin sends payment instructions outside the app, then marks the request as `payment_pending`.
4. After checking the payment in the payment provider/bank/cash ledger, record its reference or a short cash-payment note and mark it `paid`.
5. Only a `paid` request can be activated. Activation creates or reuses the centre, applies the selected plan rights for 12 months, and sends the director a password setup link.
6. If link delivery fails after the centre is provisioned, retry activation from the same request. The stored centre ID is reused; do not create another centre manually.
7. Rejections require a reason. Cancellation before activation leaves the centre and all data untouched.

The app does not collect card details, provide bank coordinates, confirm transfers, issue tax invoices, or renew subscriptions automatically. Do not mark a payment as verified based only on the customer’s message; confirm it independently and retain the supporting transaction reference.

## Vercel routing and public contact

- The Vite SPA has two HTML entry points, `index.html` and `react-app.html`. Vercel must rewrite direct navigation and refreshes for client-side routes such as `/login` and `/app` to `react-app.html`; static assets must remain served normally.
- Password setup/reset links use the current site origin. Before production, add the production URL (and only the preview origins actually used) to Supabase Auth's allowed redirect URLs.
- The contact Edge Function accepts only the configured `ALLOWED_ORIGINS`; if that secret is absent, it permits only `https://madrassa-ti.vercel.app`. Each entry must be an origin only (scheme + host + optional port), without a path or trailing slash. Configure `CONTACT_EMAIL` as `zainmawada2@gmail.com`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in Supabase Edge Function secrets. The sender must be verified in Resend. Do not put these secrets in Vite variables or the repository.
- The contact form requires Cloudflare Turnstile in addition to its server-validated honeypot and minimum/maximum completion-time check. Configure the public `VITE_TURNSTILE_SITE_KEY` in Vercel and the private `TURNSTILE_SECRET_KEY` in Supabase Edge Function secrets; the function verifies the token and checks its hostname against the request origin.
- Before enabling Turnstile, disclose Cloudflare's anti-bot processing in the privacy information and confirm the applicable transfer/retention terms. The legal page still requires operator and processor details to be completed and reviewed.
- Test the contact flow only after the Edge Function is deployed with the verified Resend sender and Turnstile keys. Confirm a permitted origin succeeds, an unapproved origin is rejected, and Resend confirms the message. Do not send test messages to a real customer.

## Preproduction migration gate

- Apply schema changes only to a separately identified, non-production Supabase project after confirming its project reference in the Supabase dashboard.
- The root `supabase/migrations/` directory contains the subscription/demo-request migrations. Additional finance, entitlements, student and teacher schema changes are currently under `backend/supabase/migrations/`; the backend README says these are not applied by the v1 workflow. Do not assume the two directories have the same remote migration history or run both blindly.
- Before applying anything, compare the preproduction schema and migration history against both directories, resolve ordering/dependencies, then apply the reviewed migration set and verify the resulting schema/RLS. Record the project reference and migration versions. Never use `db push` against production as part of this gate.

## Before accepting a commercial order

- Confirm the legal seller name, business address, registration/tax identifiers, applicable tax treatment, and invoice numbering requirements with a local accountant or legal adviser.
- Give the customer the exact written payment method, payment recipient, amount, tax treatment, validity period, renewal, cancellation, refund, and support terms before requesting payment.
- Send a compliant invoice/receipt from the seller’s accounting system after payment. The app’s finance receipts are for centre/student operations and are not a substitute for the SaaS seller’s invoice.
- Keep support requests on `zainmawada2@gmail.com` and WhatsApp `+212 6 24 43 81 40`; define response hours and an escalation contact before launch.
- Have the final legal pages reviewed. The public legal pages still identify legal publisher, jurisdiction, and some data-handling details as needing completion.

## Backup and restore operations (Supabase)

This repository cannot enable or verify backups for the remote Supabase project. Before production:

1. Enable the database backup/PITR plan appropriate to the data and retention obligations in the Supabase project settings.
2. Keep an encrypted, access-restricted off-project backup according to the agreed retention policy; do not store service-role keys or unencrypted exports in this repository.
3. Document the backup owner, schedule, retention, encryption/key custody, and incident contact.
4. In a separate non-production Supabase project, restore a recent backup and verify representative centre, student, enrollment, attendance, and finance records, plus authentication/storage dependencies.
5. Record the restore date, backup timestamp, verification results, recovery time, and any missing dependencies. Repeat after material schema changes and on a regular schedule.
6. Keep production and test projects separate. Never use real student or payment data in test runs.

The application has no automated subscription payment integration. The initial workflow is manual and requires the Super Admin to verify payment and activate the plan.
