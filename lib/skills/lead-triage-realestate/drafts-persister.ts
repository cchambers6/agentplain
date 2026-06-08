/**
 * lib/skills/lead-triage-realestate/drafts-persister.ts
 *
 * Wave-2 — first-touch draft auto-push for hot/warm real-estate leads.
 *
 * Wave 1 hardcoded `persister: null` in `./run-for-event.ts`: every
 * first-touch draft rode into /approvals only, never into the broker's
 * Gmail Drafts folder. This module is the persister that closes pride
 * theme #10 — hot/warm leads get a real Gmail/M365 DRAFT the broker can
 * open and send from their own mailbox in one click.
 *
 * Per `project_no_outbound_architecture.md`: a Gmail DRAFT is the allowed
 * RECEIVE-shape write — `users.drafts.create`, never `messages.send`. The
 * broker still presses send. The lead-triage approval row ALSO still
 * lands, so the routing decision is reviewable; the draft is a
 * convenience, not an auto-send.
 *
 * Two implementations behind the `DraftPersister` port (two-implementation
 * rule):
 *   - PROD: the live Gmail / Outlook `DraftPersister` (the same adapter
 *     `process-webhook-event` already builds), reached only when
 *     `LIVE_INBOX_FETCH` is on AND a real adapter is supplied.
 *   - DEV / default: `FixtureLeadDraftPersister` — records the draft in
 *     memory so the seam runs end-to-end with no live OAuth, and tests can
 *     assert what would have been pushed.
 *
 * CONNER ACTION: live drafts (`LIVE_INBOX_FETCH=true`) need the Google
 * OAuth consent screen verified + gmail.compose / Mail.ReadWrite scopes
 * granted.
 */

import { isLiveInboxFetchEnabled } from '@/lib/integrations/inbox/flag';
import {
  skillOk,
  type DraftPersister,
  type SkillResult,
} from '../types';

/**
 * `persistThreshold` for the auto-push path. First-touch draft confidence
 * is category-keyed in `./skill.ts#renderFirstTouchDraft`:
 *   hot = 0.82, warm = 0.74, cold = 0.60, nurture = 0.50.
 * A 0.70 floor pushes hot + warm and holds cold + nurture back — exactly
 * the "first-touch drafts for hot/warm leads" scope from the audit. Cold
 * and nurture still land an approval row with the draft text, just no
 * Gmail-side draft.
 */
export const HOT_WARM_PERSIST_THRESHOLD = 0.7;

interface RecordedDraft {
  workspaceId: string;
  threadId: string;
  toEmails: string[];
  subject: string;
  body: string;
}

/**
 * Deterministic in-memory `DraftPersister`. The default lead-triage
 * persister when `LIVE_INBOX_FETCH` is off — records the draft instead of
 * writing to a live mailbox so the auto-push seam runs in dev + tests.
 */
export class FixtureLeadDraftPersister implements DraftPersister {
  readonly name = 'fixture-lead-drafts' as const;
  readonly drafts: RecordedDraft[] = [];
  private counter = 0;

  async persistDraft(args: {
    workspaceId: string;
    threadId: string;
    inReplyToMessageId: string | null;
    toEmails: string[];
    subject: string;
    body: string;
  }): Promise<SkillResult<{ providerDraftId: string }>> {
    this.counter += 1;
    this.drafts.push({
      workspaceId: args.workspaceId,
      threadId: args.threadId,
      toEmails: [...args.toEmails],
      subject: args.subject,
      body: args.body,
    });
    return skillOk({ providerDraftId: `fixture-lead-draft-${this.counter}` });
  }
}

export interface BuildLeadDraftPersisterArgs {
  /** The live Gmail / Outlook adapter the webhook sweep already built.
   *  Used only when `LIVE_INBOX_FETCH` is on. */
  liveAdapter?: DraftPersister | null;
  /** Force the fixture impl regardless of env (tests). */
  preferFixture?: boolean;
}

/**
 * Resolve the lead-triage drafts persister. Returns the live adapter only
 * when the go-live flag is on AND a live adapter was supplied; otherwise
 * the fixture persister. Never returns null — the auto-push path is always
 * wired (the threshold, not a null persister, is what scopes it to
 * hot/warm).
 */
export function buildLeadDraftPersister(
  args: BuildLeadDraftPersisterArgs = {},
): DraftPersister {
  const useLive =
    args.preferFixture !== true &&
    isLiveInboxFetchEnabled() &&
    !!args.liveAdapter;
  if (useLive && args.liveAdapter) return args.liveAdapter;
  return new FixtureLeadDraftPersister();
}
