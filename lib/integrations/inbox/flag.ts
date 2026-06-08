/**
 * lib/integrations/inbox/flag.ts
 *
 * Single source of truth for the wave-2 "live inbox fetch" go-live gate.
 *
 * Reading a customer's REAL Gmail / M365 inbox on a cron (the
 * chief-of-staff scheduler) and auto-pushing first-touch drafts into
 * their Gmail Drafts folder both require the Google OAuth consent screen
 * to be VERIFIED and the gmail.modify / mail scopes granted. Until that
 * lands (CONNER ACTION — see the wave-2 PR), live reads stay OFF and the
 * fixture implementations run, so the seam is exercised end-to-end in dev
 * without touching a live mailbox.
 *
 * Flip `LIVE_INBOX_FETCH=true` once OAuth verification + scopes are in
 * place. The flag is read at call time (never cached at module load) so a
 * deploy-time env flip takes effect on the next cron fire without a
 * code change — consistent with `feedback_cold_start_safe_agents.md`.
 *
 * `INTEGRATIONS_PROVIDER=test` (the existing test routing knob) also
 * forces fixtures, so contract / smoke runs never hit live providers even
 * if the live flag was left on.
 */

export function isLiveInboxFetchEnabled(): boolean {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') return false;
  if (process.env.TEST_GMAIL_MCP === 'true') return false;
  return process.env.LIVE_INBOX_FETCH === 'true';
}
