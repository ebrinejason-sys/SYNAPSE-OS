-- Manual / offline subscription activation support.
-- Reuses subscription_payments + activate_subscription_payment; adds activation provenance.

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS activation_source text,
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_subscriptions_activation_source_check'
      AND conrelid = 'public.tenant_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.tenant_subscriptions
      ADD CONSTRAINT tenant_subscriptions_activation_source_check
      CHECK (
        activation_source IS NULL
        OR activation_source IN (
          'FLUTTERWAVE',
          'MANUAL_ADMIN',
          'OFFLINE_PAYMENT',
          'COMPLIMENTARY',
          'PROVISIONING'
        )
      );
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only add payment_status check when all existing values are compatible.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_subscriptions_payment_status_check'
      AND conrelid = 'public.tenant_subscriptions'::regclass
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.tenant_subscriptions
      WHERE payment_status IS NOT NULL
        AND payment_status NOT IN (
          'unpaid',
          'pending',
          'partially_paid',
          'paid',
          'waived',
          'refunded'
        )
    ) THEN
      ALTER TABLE public.tenant_subscriptions
        ADD CONSTRAINT tenant_subscriptions_payment_status_check
        CHECK (
          payment_status IN (
            'unpaid',
            'pending',
            'partially_paid',
            'paid',
            'waived',
            'refunded'
          )
        );
    END IF;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.tenant_subscriptions.activation_source IS
  'How entitlement was last activated: FLUTTERWAVE | MANUAL_ADMIN | OFFLINE_PAYMENT | COMPLIMENTARY | PROVISIONING';

COMMENT ON COLUMN public.tenant_subscriptions.payment_status IS
  'Commercial payment state: unpaid|pending|partially_paid|paid|waived|refunded';
