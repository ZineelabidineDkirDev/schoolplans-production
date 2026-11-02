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
