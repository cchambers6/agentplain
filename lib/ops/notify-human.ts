/**
 * lib/ops/notify-human.ts
 *
 * Minimal "page a designated human with context + a deadline" seam.
 *
 * ⚠️  TO BE FOLDED INTO `lib/ops/page-human.ts#pageHuman` WHEN PARALLEL
 *     WAVE pfd-1 LANDS. pfd-1 owns the real, richer pager (escalation
 *     tiers, ack tracking, dedupe). This file is the LOCAL seam pfd-4
 *     needs so the leak-path auto-refund cron meets the Conner-dead bar
 *     TODAY — it self-routes (pages a human with context + a deadline)
 *     instead of failing silently when a refund can't be auto-executed.
 *     When pfd-1's pageHuman exists on main, replace `notifyHuman` calls
 *     with `pageHuman` and delete this file.
 *
 * The seam does TWO durable things, both of which a human can find cold:
 *   1. Writes an OpsFlag row (operator-visible, queryable) carrying the
 *      reason + a human-readable deadline. The flag is the durable
 *      artifact — even if the email bounces, the row is there. Idempotent
 *      on the flag name (last-write-wins), so a re-fired cron updates the
 *      same row rather than spamming.
 *   2. Best-effort sends an operator email so the page is push, not just
 *      pull. An email failure NEVER fails the seam — the flag already
 *      captured the page.
 *
 * Per feedback_no_silent_vendor_lock: the OpsFlag write goes through the
 * OpsFlagStore adapter; the email goes through the EmailProvider adapter.
 * Per feedback_cold_start_safe_agents: the flag row is durable Postgres
 * state — a human finds it with a query, no in-memory context needed.
 */

import { getEmailProvider, type EmailProvider } from '@/lib/email';
import { env } from '@/lib/env';
import type { OpsFlagStore } from './flag-store';

/** OpsFlag name prefix for human-page rows. The operator console can
 *  facet on this prefix to surface every open page. */
export const HUMAN_PAGE_FLAG_PREFIX = 'HUMAN_PAGE_';

export interface NotifyHumanInput {
  /** Stable key for this page — becomes part of the OpsFlag name so a
   *  re-fire updates the SAME row (idempotent). Use a workspace-scoped
   *  key, e.g. `unsupported-vertical-refund:<workspaceId>`. */
  key: string;
  /** Short subject line — what needs a human. */
  subject: string;
  /** Full context a human can act on COLD — no prior conversation. Include
   *  ids, dollar amounts, what was attempted, and what's blocked. */
  body: string;
  /** Hard deadline by which a human must act. Rendered into the flag +
   *  email so the page carries urgency, not just a notice. */
  deadline: Date;
  /** Severity hint for the operator console / future pageHuman tiers. */
  severity?: 'warn' | 'critical';
}

export interface NotifyHumanResult {
  /** The OpsFlag name written (durable artifact). */
  flagName: string;
  /** True when the operator email was sent. False on email failure —
   *  the flag still stands, so the page is NOT lost. */
  emailed: boolean;
}

export interface NotifyHumanDeps {
  /** Injectable for tests. Defaults to the Prisma store at call time. */
  flagStore?: OpsFlagStore;
  /** Injectable for tests. Defaults to the live email provider. */
  email?: EmailProvider;
  /** Override recipients (tests). Defaults to OPERATOR_EMAIL_ALLOWLIST,
   *  falling back to the support inbox so a page is never silently
   *  un-addressed. */
  recipients?: string[];
}

/**
 * Page a designated human. Always writes the durable OpsFlag; best-effort
 * emails. Returns the flag name so the caller can audit it.
 */
export async function notifyHuman(
  input: NotifyHumanInput,
  deps: NotifyHumanDeps = {},
): Promise<NotifyHumanResult> {
  const flagName = `${HUMAN_PAGE_FLAG_PREFIX}${input.key}`;
  const severity = input.severity ?? 'critical';
  const deadlineIso = input.deadline.toISOString();

  const note =
    `[${severity.toUpperCase()}] ${input.subject}\n` +
    `Deadline: ${deadlineIso}\n\n` +
    input.body;

  const flagStore = deps.flagStore ?? (await getDefaultFlagStore());
  // The OpsFlag is the durable page. value="open" until a human clears it.
  await flagStore.set(flagName, 'open', {
    updatedBy: 'pfd-4:notify-human',
    note,
  });

  // Best-effort push. An email failure must not lose the page — the flag
  // is already durable.
  let emailed = false;
  const recipients =
    deps.recipients ??
    (env.operatorEmailAllowlist().length > 0
      ? env.operatorEmailAllowlist()
      : [env.supportEmail()]);
  try {
    const email = deps.email ?? getEmailProvider();
    for (const to of recipients) {
      await email.send({
        to,
        subject: `[agentplain ops] ${input.subject}`,
        text: note,
        html: renderHtml({ subject: input.subject, body: input.body, deadlineIso, severity }),
        tags: { kind: 'human_page', page_key: input.key, severity },
      });
    }
    emailed = recipients.length > 0;
  } catch {
    // Swallow — the durable flag already captured the page.
    emailed = false;
  }

  return { flagName, emailed };
}

/** Lazily construct the Prisma flag store only when no override is passed,
 *  keeping this module importable without pulling Prisma at module load. */
let _defaultFlagStore: OpsFlagStore | null = null;
async function getDefaultFlagStore(): Promise<OpsFlagStore> {
  if (_defaultFlagStore) return _defaultFlagStore;
  const { PrismaOpsFlagStore } = await import('./prisma-flag-store');
  _defaultFlagStore = new PrismaOpsFlagStore();
  return _defaultFlagStore;
}

/** Test-only reset of the lazy store. */
export function __resetNotifyHumanStoreForTests(): void {
  _defaultFlagStore = null;
}

function renderHtml(args: {
  subject: string;
  body: string;
  deadlineIso: string;
  severity: string;
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  return [
    '<!doctype html><html><body style="font-family: ui-monospace,monospace; color:#1c1917;">',
    `<p style="color:#b91c1c;font-weight:600;">[${esc(args.severity.toUpperCase())}] ${esc(args.subject)}</p>`,
    `<p><strong>Deadline:</strong> ${esc(args.deadlineIso)}</p>`,
    `<pre style="white-space:pre-wrap;background:#f5f5f4;padding:12px;border-radius:4px;">${esc(args.body)}</pre>`,
    '</body></html>',
  ].join('');
}
