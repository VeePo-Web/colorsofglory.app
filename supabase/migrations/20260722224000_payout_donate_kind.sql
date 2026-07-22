-- "Give it forward" — a referrer may choose to donate their payout instead of
-- collecting it (charity model A: COG donates on the referrer's behalf; the
-- payout row is still approved + marked paid with the donation receipt as the
-- provider reference, so the ledger reconciles exactly like a cash payout).
--
-- Enum-only migration: a new enum value cannot be USED in the transaction that
-- adds it, so every function/UI reference lives in the companion hardening
-- migration that runs after this one commits.

ALTER TYPE public.payout_method_kind ADD VALUE IF NOT EXISTS 'donate';
