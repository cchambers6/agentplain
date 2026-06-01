/**
 * lib/onboarding/draft-preview.ts
 *
 * Wave-10 phase-3b: extract a CUSTOMER-READABLE preview from a
 * `WorkApprovalQueueItem.payload` so the onboarding watch panel can
 * render the actual draft body inline. The wizard's first-fire panel
 * previously showed a status pill ("drafted") and a deep-link to
 * /approvals; the customer had to click through to see the draft. Now
 * the draft body lands right inside the wizard card.
 *
 * The extractor knows the payload shapes for every skill the wizard's
 * `picked-skills.ts` filter actually surfaces (the cross-vertical /
 * inbox-required general skills). Vertical-specific skills (real-estate
 * lead triage, CPA month-end-close, etc.) are NOT in the picker today
 * per the wave-10 audit doc (`docs/wave10-vertical-skill-runtime-
 * audit-2026-05-31.md`), so their payloads land in the generic-fallback
 * branch.
 *
 * Per `project_no_outbound_architecture.md`: this function only READS a
 * decrypted payload and shapes it for display. No writes.
 *
 * Per `project_plaino_named_agent.md`: titles read in the Plaino voice —
 * "Here's the draft Plaino made for…" not "AI output ready."
 */

export interface DraftPreview {
  /** Short customer-readable title — names what was drafted. */
  title: string;
  /** The draft body itself. Plain text (newlines preserved). Length
   *  bounded for the wizard render — the customer can click through to
   *  /approvals for the full row. */
  body: string;
  /** Optional key-value bits the wizard renders as compact rows
   *  underneath the title (e.g. "To: jane@example.com",
   *  "Subject: Re: …"). Limit to 4 keys; longer values truncated. */
  meta?: Array<{ label: string; value: string }>;
}

const MAX_BODY_CHARS = 1200;
const MAX_META_VALUE_CHARS = 120;

/** Trim + length-cap so the wizard never renders a runaway payload. */
function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item);
    if (s) out.push(s);
  }
  return out.length > 0 ? out : null;
}

/**
 * Pull a customer-readable preview from a decrypted payload. Returns
 * null when the kind isn't one we have a renderer for AND the payload
 * has no obvious body-shaped field — the watch panel falls back to the
 * generic "open in approvals" affordance.
 *
 * The function never throws; a malformed payload returns null.
 */
export function extractDraftPreview(
  kind: string,
  payload: unknown,
): DraftPreview | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const p = payload as Record<string, unknown>;

  switch (kind) {
    case 'ANALYTICS_PULSE':
      return buildPulsePreview(p, 'analytics pulse', "Plaino's pulse on your week");
    case 'FINANCE_PULSE':
      return buildPulsePreview(p, 'finance pulse', "Plaino's finance pulse");
    case 'COMPLIANCE_DIGEST':
    case 'COMPLIANCE_FLAG':
      return buildCompliancePreview(p);
    case 'CONTENT_CALENDAR':
      return buildContentCalendarPreview(p);
    case 'FOLLOW_UP_NUDGE':
      return buildEmailDraftPreview(p, 'follow-up nudge');
    case 'CHIEF_OF_STAFF_REPLY_DRAFT':
    case 'BUYER_INQUIRY_REPLY_DRAFT':
    case 'SUPPORT_HANDLER_REPLY_DRAFT':
      return buildEmailDraftPreview(p, 'reply draft');
    case 'CHIEF_OF_STAFF_MEETING':
      return buildMeetingPreview(p);
    case 'CHIEF_OF_STAFF_TODO':
      return buildTodoPreview(p);
    case 'PROCESS_DOC_DRAFT':
      return buildProcessDocPreview(p);
    case 'INBOX_TRIAGE':
      return buildInboxTriagePreview(p);
    case 'ADMIN_VERIFICATION_CODE':
    case 'ADMIN_PASSWORD_RESET':
    case 'ADMIN_TRIAL_ENDING':
    case 'ADMIN_BILLING_NOTICE':
    case 'ADMIN_SECURITY_ALERT':
      return buildAdminPreview(p, kind);
    default:
      return buildGenericPreview(p);
  }
}

function buildPulsePreview(
  p: Record<string, unknown>,
  shortLabel: string,
  title: string,
): DraftPreview | null {
  const body = asString(p.body);
  if (!body) return null;
  const meta: DraftPreview['meta'] = [];
  const forWeek = asString(p.forWeekStarting);
  if (forWeek) meta.push({ label: 'For week of', value: clip(forWeek, MAX_META_VALUE_CHARS) });
  const recs = asStringArray(p.recommendations);
  if (recs && recs.length > 0) {
    meta.push({
      label: 'Recommendations',
      value: clip(recs.slice(0, 3).join('; '), MAX_META_VALUE_CHARS),
    });
  }
  return {
    title,
    body: clip(body, MAX_BODY_CHARS),
    meta: meta.length > 0 ? meta : undefined,
  };
}

function buildCompliancePreview(
  p: Record<string, unknown>,
): DraftPreview | null {
  const body = asString(p.body);
  if (!body) return null;
  const matches = Array.isArray(p.matches) ? p.matches.length : null;
  const meta: DraftPreview['meta'] = [];
  if (matches !== null) {
    meta.push({
      label: 'Items flagged',
      value: String(matches),
    });
  }
  const forDate = asString(p.forDate);
  if (forDate) meta.push({ label: 'For', value: clip(forDate, MAX_META_VALUE_CHARS) });
  return {
    title: "Plaino's compliance sweep",
    body: clip(body, MAX_BODY_CHARS),
    meta: meta.length > 0 ? meta : undefined,
  };
}

function buildContentCalendarPreview(
  p: Record<string, unknown>,
): DraftPreview | null {
  const preamble = asString(p.preamble);
  const days = Array.isArray(p.days) ? p.days : [];
  if (!preamble && days.length === 0) return null;

  const bodyParts: string[] = [];
  if (preamble) bodyParts.push(preamble);
  for (const day of days.slice(0, 5)) {
    if (!day || typeof day !== 'object') continue;
    const d = day as Record<string, unknown>;
    const dateLabel = asString(d.dayLabel) ?? asString(d.date) ?? 'Day';
    const hook = asString(d.hook) ?? asString(d.topic) ?? '';
    const channel = asString(d.channel);
    bodyParts.push(`${dateLabel}${channel ? ` (${channel})` : ''}: ${hook}`);
  }
  const meta: DraftPreview['meta'] = [];
  const forWeek = asString(p.forWeekStarting);
  if (forWeek) meta.push({ label: 'For week of', value: clip(forWeek, MAX_META_VALUE_CHARS) });
  return {
    title: "Plaino's content calendar for the week",
    body: clip(bodyParts.join('\n\n'), MAX_BODY_CHARS),
    meta: meta.length > 0 ? meta : undefined,
  };
}

function buildEmailDraftPreview(
  p: Record<string, unknown>,
  shortLabel: string,
): DraftPreview | null {
  const body = asString(p.body) ?? asString(p.draftBody);
  if (!body) return null;
  const meta: DraftPreview['meta'] = [];
  const toList = asStringArray(p.toEmails) ?? asStringArray(p.to);
  if (toList && toList.length > 0) {
    meta.push({
      label: 'To',
      value: clip(toList.slice(0, 3).join(', '), MAX_META_VALUE_CHARS),
    });
  }
  const subject = asString(p.subject);
  if (subject) {
    meta.push({ label: 'Subject', value: clip(subject, MAX_META_VALUE_CHARS) });
  }
  const stage = asString(p.stage);
  if (stage) meta.push({ label: 'Stage', value: clip(stage, MAX_META_VALUE_CHARS) });
  return {
    title: `Plaino drafted a ${shortLabel}`,
    body: clip(body, MAX_BODY_CHARS),
    meta: meta.length > 0 ? meta : undefined,
  };
}

function buildMeetingPreview(
  p: Record<string, unknown>,
): DraftPreview | null {
  const slots = Array.isArray(p.proposedSlots) ? p.proposedSlots : [];
  if (slots.length === 0) {
    const body = asString(p.body);
    if (!body) return null;
    return {
      title: 'Plaino proposed a meeting',
      body: clip(body, MAX_BODY_CHARS),
    };
  }
  const lines: string[] = [];
  for (const slot of slots.slice(0, 5)) {
    if (!slot || typeof slot !== 'object') continue;
    const s = slot as Record<string, unknown>;
    const label = asString(s.label) ?? asString(s.startAt) ?? '';
    if (label) lines.push(`• ${label}`);
  }
  const meta: DraftPreview['meta'] = [];
  const counterpart = asString(p.counterpartName) ?? asString(p.counterpartEmail);
  if (counterpart) meta.push({ label: 'With', value: clip(counterpart, MAX_META_VALUE_CHARS) });
  return {
    title: 'Plaino proposed meeting times',
    body: clip(lines.join('\n'), MAX_BODY_CHARS),
    meta: meta.length > 0 ? meta : undefined,
  };
}

function buildTodoPreview(p: Record<string, unknown>): DraftPreview | null {
  const summary = asString(p.summary) ?? asString(p.title);
  const detail = asString(p.detail) ?? asString(p.body);
  if (!summary && !detail) return null;
  const bodyParts: string[] = [];
  if (summary) bodyParts.push(summary);
  if (detail && detail !== summary) bodyParts.push(detail);
  return {
    title: 'Plaino noted a to-do',
    body: clip(bodyParts.join('\n\n'), MAX_BODY_CHARS),
  };
}

function buildProcessDocPreview(
  p: Record<string, unknown>,
): DraftPreview | null {
  const body = asString(p.body) ?? asString(p.draftBody) ?? asString(p.markdown);
  if (!body) return null;
  const meta: DraftPreview['meta'] = [];
  const procName = asString(p.processName) ?? asString(p.title);
  if (procName) meta.push({ label: 'Process', value: clip(procName, MAX_META_VALUE_CHARS) });
  return {
    title: 'Plaino drafted an SOP',
    body: clip(body, MAX_BODY_CHARS),
    meta: meta.length > 0 ? meta : undefined,
  };
}

function buildInboxTriagePreview(
  p: Record<string, unknown>,
): DraftPreview | null {
  const summary = asString(p.summary) ?? asString(p.draftBody) ?? asString(p.body);
  if (!summary) return null;
  const meta: DraftPreview['meta'] = [];
  const bucket = asString(p.bucket) ?? asString(p.category);
  if (bucket) meta.push({ label: 'Bucket', value: clip(bucket, MAX_META_VALUE_CHARS) });
  const fromAddr = asString(p.from) ?? asString(p.fromEmail);
  if (fromAddr) meta.push({ label: 'From', value: clip(fromAddr, MAX_META_VALUE_CHARS) });
  return {
    title: 'Plaino triaged a thread',
    body: clip(summary, MAX_BODY_CHARS),
    meta: meta.length > 0 ? meta : undefined,
  };
}

function buildAdminPreview(
  p: Record<string, unknown>,
  kind: string,
): DraftPreview | null {
  const subject = asString(p.subject) ?? asString(p.title) ?? prettyKind(kind);
  const body =
    asString(p.body) ?? asString(p.description) ?? asString(p.summary);
  if (!body) {
    return {
      title: `Plaino routed an ${prettyKind(kind)}`,
      body: subject,
    };
  }
  const meta: DraftPreview['meta'] = [];
  const fromAddr = asString(p.from) ?? asString(p.sender);
  if (fromAddr) meta.push({ label: 'From', value: clip(fromAddr, MAX_META_VALUE_CHARS) });
  return {
    title: `Plaino routed an ${prettyKind(kind)}`,
    body: clip(body, MAX_BODY_CHARS),
    meta: meta.length > 0 ? meta : undefined,
  };
}

function prettyKind(kind: string): string {
  // ADMIN_VERIFICATION_CODE → "admin verification code"
  return kind.toLowerCase().replace(/_/g, ' ');
}

function buildGenericPreview(
  p: Record<string, unknown>,
): DraftPreview | null {
  const body =
    asString(p.body) ?? asString(p.summary) ?? asString(p.description);
  if (!body) return null;
  return {
    title: 'Plaino drafted a result',
    body: clip(body, MAX_BODY_CHARS),
  };
}
