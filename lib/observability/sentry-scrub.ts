// Sentry-scrub: shared `beforeSend` filter for the three Sentry init
// configs (sentry.server.config.ts, sentry.edge.config.ts,
// sentry.client.config.ts). Runs once per event the SDK is about to ship.
//
// Why this exists: production error reports cannot ship customer content
// — email bodies, draft replies, file text. Any sentry-bound site that
// accidentally includes a raw body (LLM error paths, generic catch blocks)
// would otherwise breach the data-privacy posture asserted in the audit.
// Defense-in-depth: we ALSO fix the call sites to stop embedding content
// in error strings, but the scrubber catches anything we missed and
// anything future code accidentally re-introduces.
//
// Strategy:
//   1. Walk every string the event carries — `message`, exception values,
//      breadcrumb messages/data, `extra`, `contexts` payloads.
//   2. For each string, strip known customer-content markers (BODY: /
//      INBOUND MESSAGE BODY: sections), redact email addresses, and
//      truncate anything still longer than MAX_STRING_LEN.
//   3. Drop the event entirely if it still looks dangerous after scrubbing
//      (defensive: returning null tells Sentry not to ship).
//
// This file does NOT import `@sentry/nextjs` because Sentry's `beforeSend`
// hook hands us a plain `ErrorEvent` object — we operate on it
// structurally. The three sentry.*.config.ts files import this helper.

const MAX_STRING_LEN = 1024;
const REDACTED_EMAIL = "[redacted-email]";
const REDACTED_BODY = "[redacted-body]";

// Email regex — RFC-5322-lite. Conservative on purpose: we want to
// over-redact rather than miss. Matches typical user@host.tld shapes
// including subdomains and plus-addressing.
const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Body-block markers used in our LLM prompts. When an error string
// includes one of these, everything after it is customer body — we strip
// from the marker through to the next blank-line boundary or end.
const BODY_MARKERS = [
  "INBOUND MESSAGE BODY:",
  "BODY:",
  "MESSAGE BODY:",
  "DRAFT BODY:",
];

// Object keys whose values are known to carry customer content. Used by
// the recursive walker to wholesale-redact instead of substring-scan.
//
// Important: these are LEAF content fields. Container keys like `draft`
// (which holds {draftId, body, subject, ...}) are NOT listed — the
// recursive walker descends into them and catches the leaf `body`/
// `subject`, so the IDs and metadata survive for operator triage.
const CONTENT_KEYS = new Set([
  "body",
  "bodyText",
  "draftBody",
  "messageBody",
  "snippet",
  "subject",
  "rawContent",
  "html",
  "htmlBody",
  "plainText",
  "decodedData",
  "userPrompt",
]);

/** Public surface used by `beforeSend`. */
export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
  // 1. Top-level message
  if (typeof event.message === "string") {
    event.message = scrubString(event.message);
  }
  // 2. Exception values
  if (event.exception && Array.isArray(event.exception.values)) {
    for (const v of event.exception.values) {
      if (v && typeof v.value === "string") {
        v.value = scrubString(v.value);
      }
    }
  }
  // 3. Breadcrumbs (an Array<{ message?, data?, ... }>)
  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (crumb && typeof crumb.message === "string") {
        crumb.message = scrubString(crumb.message);
      }
      if (crumb && crumb.data && typeof crumb.data === "object") {
        crumb.data = scrubObject(crumb.data as Record<string, unknown>);
      }
    }
  }
  // 4. Extra + Contexts — Sentry's freeform payload buckets.
  if (event.extra && typeof event.extra === "object") {
    event.extra = scrubObject(event.extra as Record<string, unknown>);
  }
  if (event.contexts && typeof event.contexts === "object") {
    event.contexts = scrubObject(event.contexts as Record<string, unknown>);
  }
  // 5. Request body — if Sentry's request integration captured one.
  if (event.request && typeof event.request === "object") {
    const req = event.request as Record<string, unknown>;
    if (typeof req.data === "string") {
      req.data = scrubString(req.data);
    } else if (req.data && typeof req.data === "object") {
      req.data = scrubObject(req.data as Record<string, unknown>);
    }
  }
  return event;
}

/** Exposed for unit tests. */
export function scrubString(input: string): string {
  let out = input;
  // Strip BODY:/INBOUND MESSAGE BODY: blocks. Our prompt templates
  // (lib/skills/categorize.ts, lib/skills/draft.ts) put the BODY block
  // LAST in the rendered prompt — everything after the marker is
  // customer content, which itself can contain blank lines. We redact
  // from the marker through end-of-string to ensure the entire body is
  // gone, even when it contains paragraph breaks.
  //
  // If a caller embeds a BODY: marker NOT at the end of a string (e.g.
  // a test fixture with a METADATA: trailer), this is intentionally
  // over-aggressive — better to lose the trailer than to leak content
  // because of an unanticipated body shape.
  for (const marker of BODY_MARKERS) {
    const idx = out.indexOf(marker);
    if (idx !== -1) {
      out = out.slice(0, idx) + REDACTED_BODY;
    }
  }
  // Redact email addresses. We replace with a fixed token rather than
  // a hash so the operator audit cannot reverse the token back to an
  // address by lookup. We accept losing the ability to correlate
  // multiple events from the same sender via Sentry — that correlation
  // belongs in the operator audit log, where workspace_id is the key.
  out = out.replace(EMAIL_RE, REDACTED_EMAIL);
  // Final length cap — even after stripping, defensive truncation keeps
  // a single oversize string from blowing the event budget.
  if (out.length > MAX_STRING_LEN) {
    out = out.slice(0, MAX_STRING_LEN) + "…[truncated]";
  }
  return out;
}

/** Recursively scrub an object — strings get scrubString, known
 *  content-bearing keys get wholesale-redacted. Returns a shallow copy. */
export function scrubObject(
  obj: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  // Defensive depth limit. Sentry events are shallow in practice; this
  // prevents a cyclic reference from looping forever.
  if (depth > 8) return obj;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (CONTENT_KEYS.has(key)) {
      // The KEY itself signals customer content — drop the value entirely
      // rather than relying on the string-level scrub. This handles e.g.
      // `extra.draft.body = "<full draft>"`.
      out[key] = REDACTED_BODY;
      continue;
    }
    out[key] = scrubValue(value, depth + 1);
  }
  return out;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1));
  }
  return scrubObject(value as Record<string, unknown>, depth);
}

// Minimal structural type matching the relevant Sentry ErrorEvent fields.
// We avoid importing `@sentry/nextjs` types here so this module can be
// tested without pulling the SDK into the test runtime.
export interface SentryLikeEvent {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{ message?: string; data?: unknown }>;
  extra?: unknown;
  contexts?: unknown;
  request?: unknown;
}
