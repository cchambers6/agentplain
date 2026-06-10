/**
 * lib/ops/page-human.ts
 *
 * The single "page a human" choke point for the self-healing fleet.
 *
 * The acceptance bar for this whole pillar: if Conner died tomorrow, every
 * surface still either self-heals, self-routes (detect + page a designated
 * human with full context + a deadline), or fails loud. `pageHuman` is the
 * self-route. Every place in the codebase that decides "a person needs to
 * know about this" routes through here, so there is exactly ONE observable
 * seam to watch, test, and (later) point at PagerDuty/Slack instead of email.
 *
 * What it does on every call:
 *   1. Resolves the recipient(s):
 *        - `FLEET_TRUSTED_HUMAN_EMAIL` (comma-separated) when set — the
 *          designated trusted human, ideally NOT Conner's personal inbox so
 *          the alert survives him.
 *        - otherwise the first `OPERATOR_EMAIL_ALLOWLIST` entry (Conner
 *          today) AND a line in the email body noting that no designated
 *          fallback human is configured. A loud nudge, never a silent drop.
 *        - if BOTH are empty, the email cannot be addressed — we still
 *          persist the page row (the loud-fail artifact the operator UI
 *          reads) and return `delivered: false` so the caller knows the
 *          page didn't reach a person.
 *   2. Sends the alert via the EXISTING `lib/email` seam (Resend underneath
 *      in prod, the in-memory test provider in tests) — never the Resend SDK
 *      directly (feedback_no_silent_vendor_lock).
 *   3. Persists EVERY page as an `AuditLog` row (`action: 'ops.page_human'`),
 *      whether or not the email was deliverable, so the page is observable
 *      even when the email channel itself is down (the credential-test cron's
 *      Resend-dead special case relies on this).
 *
 * Cold-start safe (feedback_cold_start_safe_agents): reads recipients from
 * `process.env` on every call; holds no in-memory state. The email provider
 * + system-context runner are injectable so the test provider satisfies the
 * two-implementation rule without a live Resend key or DB.
 *
 * No-throw contract: `pageHuman` never throws. A page that can't be emailed
 * or persisted still resolves to a structured `PageHumanResult` describing
 * exactly what happened — paging must not itself become a silent failure.
 */

import { env } from "../env";
import { getEmailProvider, type EmailProvider } from "../email";
import { withSystemContext as defaultWithSystemContext } from "../db";

/** Triage levels. `critical` = customer-impacting and/or 24h-deadline; the
 *  others are lower-urgency operator FYIs that still want one observable
 *  seam rather than scattered ad-hoc emails. */
export type PageSeverity = "info" | "warn" | "critical";

export interface PageHumanInput {
  severity: PageSeverity;
  /** One-line subject-worthy summary. Shown in the email subject + the
   *  AuditLog payload. Keep it scannable on a phone lock screen. */
  summary: string;
  /** Full context: which credential/key failed, how, what the customer
   *  impact is, what's already been done automatically. The person reading
   *  this should be able to act with zero prior knowledge of the incident. */
  details: string;
  /** When the situation needs human action by — e.g. a 24h restore deadline.
   *  Surfaced prominently. Omit for pure FYIs. */
  deadline?: Date;
  /** Stable source tag for the page (e.g. 'llm-key-rotation',
   *  'credential-test-cron'). Stored on the AuditLog row for filtering. */
  source?: string;
  /** Optional workspace this page concerns. NULL for fleet-wide pages
   *  (a failed global key affects every workspace). */
  workspaceId?: string;
}

export interface PageHumanResult {
  /** True iff the email was handed to the email provider for at least one
   *  recipient. False when no recipient could be resolved OR the send threw. */
  delivered: boolean;
  /** Recipients the page was addressed to (empty when none resolved). */
  recipients: string[];
  /** True when we fell back to the operator allowlist because no
   *  `FLEET_TRUSTED_HUMAN_EMAIL` was configured. Drives the in-body nudge. */
  usedFallbackRecipient: boolean;
  /** True iff the page was persisted as an AuditLog row. The loud-fail
   *  artifact — when the email channel is dead this is the only record. */
  persisted: boolean;
  /** The AuditLog row id when persisted; null otherwise. */
  auditLogId: string | null;
  /** Populated when send or persist failed, for the caller's logs. */
  emailError?: string;
  persistError?: string;
}

/** The AuditLog action string every page row carries. Operator surfaces
 *  filter on this to render the "fleet paged a human" feed. */
export const PAGE_HUMAN_AUDIT_ACTION = "ops.page_human";

/** Stable nudge copy when no designated fallback human is configured. Tested
 *  against verbatim so the loud nudge can't silently regress. */
export const NO_FALLBACK_HUMAN_NOTICE =
  "No designated fallback human is configured — set FLEET_TRUSTED_HUMAN_EMAIL to a monitored inbox so these alerts survive any single person.";

export interface PageHumanDeps {
  email?: EmailProvider;
  /** System-context Prisma runner. Defaults to the RLS system context so the
   *  page row writes from the operator identity. Tests inject an in-memory
   *  runner or a throwing one to exercise the persist-failure path. */
  systemContext?: typeof defaultWithSystemContext;
  /** Env snapshot for recipient resolution. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Page a human. Never throws. Always attempts to persist the page row even
 * when the email cannot be sent, so the alert is observable through the
 * operator UI even if the email channel itself is what failed.
 */
export async function pageHuman(
  input: PageHumanInput,
  deps: PageHumanDeps = {},
): Promise<PageHumanResult> {
  const recipientResolution = resolveRecipients(deps.env ?? process.env);
  const recipients = recipientResolution.recipients;
  const usedFallbackRecipient = recipientResolution.usedFallback;

  const subject = renderSubject(input);
  const text = renderText(input, usedFallbackRecipient);
  const html = renderHtml(input, usedFallbackRecipient);

  // ── Send (best-effort) ──────────────────────────────────────────────
  let delivered = false;
  let emailError: string | undefined;
  if (recipients.length > 0) {
    try {
      const email = deps.email ?? getEmailProvider();
      // One message per recipient keeps a bounced address from suppressing
      // delivery to the others (Resend treats `to` as a single envelope).
      for (const to of recipients) {
        await email.send({
          to,
          subject,
          html,
          text,
          tags: {
            kind: "ops_page_human",
            severity: input.severity,
            ...(input.source ? { source: input.source } : {}),
          },
        });
      }
      delivered = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
    }
  } else {
    emailError =
      "no recipient configured (FLEET_TRUSTED_HUMAN_EMAIL and OPERATOR_EMAIL_ALLOWLIST both empty)";
  }

  // ── Persist (best-effort, ALWAYS attempted) ─────────────────────────
  // The page row is written whether or not the email was delivered — it is
  // the loud-fail artifact the operator UI reads when the email channel is
  // the thing that's broken (credential-test cron's Resend-dead case).
  let persisted = false;
  let auditLogId: string | null = null;
  let persistError: string | undefined;
  try {
    const systemContext = deps.systemContext ?? defaultWithSystemContext;
    const row = await systemContext((tx) =>
      tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId ?? null,
          action: PAGE_HUMAN_AUDIT_ACTION,
          targetTable: "OpsPage",
          targetId: input.source ?? null,
          payload: {
            severity: input.severity,
            summary: input.summary,
            details: input.details,
            deadline: input.deadline ? input.deadline.toISOString() : null,
            source: input.source ?? null,
            recipients,
            usedFallbackRecipient,
            emailDelivered: delivered,
            ...(emailError ? { emailError } : {}),
          },
        },
        select: { id: true },
      }),
    );
    auditLogId = row.id;
    persisted = true;
  } catch (err) {
    persistError = err instanceof Error ? err.message : String(err);
  }

  return {
    delivered,
    recipients,
    usedFallbackRecipient,
    persisted,
    auditLogId,
    ...(emailError ? { emailError } : {}),
    ...(persistError ? { persistError } : {}),
  };
}

/** Resolve recipients from the trusted-human var, falling back to the first
 *  operator allowlist entry. Reads env on every call (cold-start safe). */
export function resolveRecipients(envSnapshot: NodeJS.ProcessEnv = process.env): {
  recipients: string[];
  usedFallback: boolean;
} {
  const trusted = parseList(envSnapshot.FLEET_TRUSTED_HUMAN_EMAIL);
  if (trusted.length > 0) {
    return { recipients: trusted, usedFallback: false };
  }
  const allowlist = parseList(envSnapshot.OPERATOR_EMAIL_ALLOWLIST);
  // Page only the FIRST operator (the primary), not the whole allowlist —
  // the allowlist gates operator console access, which is a broader set
  // than "the person who gets paged at 2am".
  if (allowlist.length > 0) {
    return { recipients: [allowlist[0]], usedFallback: true };
  }
  return { recipients: [], usedFallback: false };
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

const SEVERITY_PREFIX: Record<PageSeverity, string> = {
  info: "[agentplain ops · info]",
  warn: "[agentplain ops · warn]",
  critical: "[agentplain ops · CRITICAL]",
};

function renderSubject(input: PageHumanInput): string {
  return `${SEVERITY_PREFIX[input.severity]} ${input.summary}`;
}

function deadlineLine(deadline?: Date): string | null {
  if (!deadline) return null;
  return `Action needed by: ${deadline.toISOString()} (UTC).`;
}

function renderText(input: PageHumanInput, usedFallback: boolean): string {
  const lines: string[] = [];
  lines.push(`Severity: ${input.severity.toUpperCase()}`);
  lines.push("");
  lines.push(input.summary);
  lines.push("");
  lines.push(input.details);
  const dl = deadlineLine(input.deadline);
  if (dl) {
    lines.push("");
    lines.push(dl);
  }
  if (input.source) {
    lines.push("");
    lines.push(`Source: ${input.source}`);
  }
  if (usedFallback) {
    lines.push("");
    lines.push(NO_FALLBACK_HUMAN_NOTICE);
  }
  lines.push("");
  lines.push(
    "This is an automated page from the agentplain fleet. It fired because a credential or key could not self-heal.",
  );
  return lines.join("\n");
}

function renderHtml(input: PageHumanInput, usedFallback: boolean): string {
  const dl = deadlineLine(input.deadline);
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif; color:#1A1A1F; background:#F7F4ED; padding:24px;">
  <p style="font-size:13px; letter-spacing:0.04em; text-transform:uppercase; color:${input.severity === "critical" ? "#B42318" : "#8C8478"}; margin:0 0 8px;">Severity: ${escapeHtml(input.severity)}</p>
  <h2 style="font-weight:600; color:#1A1A1F; margin:0 0 16px;">${escapeHtml(input.summary)}</h2>
  <pre style="white-space:pre-wrap; font-family:inherit; font-size:14px; line-height:1.5; color:#1A1A1F; margin:0 0 16px;">${escapeHtml(input.details)}</pre>
  ${dl ? `<p style="font-weight:600; color:#B42318; margin:0 0 16px;">${escapeHtml(dl)}</p>` : ""}
  ${input.source ? `<p style="font-size:13px; color:#8C8478; margin:0 0 8px;">Source: ${escapeHtml(input.source)}</p>` : ""}
  ${usedFallback ? `<p style="font-size:13px; color:#B42318; background:#FEF3F2; padding:12px; border-radius:6px; margin:16px 0 0;">${escapeHtml(NO_FALLBACK_HUMAN_NOTICE)}</p>` : ""}
  <p style="font-size:12px; color:#8C8478; margin:24px 0 0;">Automated page from the agentplain fleet — fired because a credential or key could not self-heal.</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
