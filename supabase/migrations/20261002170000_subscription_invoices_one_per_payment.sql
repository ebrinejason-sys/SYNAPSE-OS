-- One subscription invoice per payment.
--
-- confirmSubscriptionPayment can run concurrently for the same payment (Flutterwave
-- webhook + the customer's redirect verify, or webhook retries). Activation itself is
-- idempotent (activate_subscription_payment locks the payment row), but invoicing
-- used a check-then-insert that could mint two invoice numbers for one payment.
--
-- Prod check (read-only, 2 Oct 2026): 1 invoice, 0 payments with >1 invoice.
-- Forward-safe: a partial unique index; tiny table → brief lock. If duplicates ever
-- exist the CREATE fails (no data is changed) — dedupe manually first.
-- Rollback: drop index if exists public.subscription_invoices_payment_id_uidx;

create unique index if not exists subscription_invoices_payment_id_uidx
  on public.subscription_invoices (payment_id)
  where payment_id is not null;
