-- Voice integration layer — new WorkApprovalKind values.
-- (feat/voice-twilio-integration-2026-06-17)
--
-- The voice layer writes into the EXISTING approvals queue rather than a new
-- table, so it only needs two new enum members on WorkApprovalKind:
--
--   VOICE_CALL_ACTION_ITEM  — a draft follow-up extracted from a completed
--                             inbound call by lib/voice/transcript-actions.ts.
--                             Draft-only; reviewed on /approvals.
--   VOICE_RECORDING_CONSENT — the workspace owner's explicit, policy-bound
--                             opt-in to record + retain calls, gated by
--                             lib/voice/recording.ts. Recording stays OFF until
--                             this is APPROVED.
--
-- Neon is PostgreSQL 16, which permits ALTER TYPE ... ADD VALUE inside the
-- migration transaction. The new values are NOT referenced by any DML in this
-- file, so the same-transaction-use restriction does not apply. Purely
-- additive — no existing rows, columns, or indexes change.

ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'VOICE_CALL_ACTION_ITEM';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'VOICE_RECORDING_CONSENT';
