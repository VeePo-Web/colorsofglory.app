-- Payout reconciliation invariants (defense in depth beneath the admin-payouts
-- edge guard and the PayoutBatches UI).
--
-- A payout marked `paid` MUST carry a provider reference (PayPal batch id /
-- Stripe transfer id) or it can never be reconciled against the processor.
-- A payout marked `failed` MUST carry a reason or the audit trail is incomplete.
-- Enforcing this at the table means no write path — RPC, edge function, future
-- tooling, or the SQL console — can ever bypass it.
--
-- Added NOT VALID so deployment never fails on any pre-existing rows; the
-- constraints are enforced on every new insert/update from here forward.
-- mark_payout_paid / mark_payout_failed already set status and the required
-- column in a single UPDATE, so those RPCs continue to pass.

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_paid_needs_provider
  CHECK (
    status::text <> 'paid'
    OR (provider_payout_id IS NOT NULL AND btrim(provider_payout_id) <> '')
  ) NOT VALID;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_failed_needs_reason
  CHECK (
    status::text <> 'failed'
    OR (failure_reason IS NOT NULL AND btrim(failure_reason) <> '')
  ) NOT VALID;
