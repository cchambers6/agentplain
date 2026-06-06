/**
 * lib/llm/test-provider.ts
 *
 * Second implementation of `LlmProvider`. Per `feedback_runner_portability.md`:
 * every adapter category has at least two implementations. This is the
 * contract-pinning peer of `lib/llm/anthropic-provider.ts`.
 *
 * Two operating modes:
 *
 *   1. **Seeded map mode.** Tests pass a `seed` map keyed by a stable
 *      digest of the request (system + last user message); the provider
 *      returns the canned response. Missing keys produce a deterministic
 *      placeholder response so a test that forgets to seed still
 *      progresses past the skill boundary and the assertion catches the
 *      semantic gap, not a thrown error.
 *
 *   2. **Heuristic mode.** When no seed is provided, the provider runs a
 *      tiny rule-set against the request text to produce sensible-shaped
 *      output for each skill. This lets the e2e test pass without
 *      maintaining a per-fixture seed table — the heuristic is
 *      *deliberately simple* (substring matching) so it is obvious to a
 *      reader what the test is asserting.
 *
 * Per `feedback_no_guesses_no_estimates`: every heuristic rule cites the
 * skill it serves and the categorization-spec line it implements (see
 * `lib/skills/prompts/<vertical>.ts`).
 *
 * Per `project_no_outbound_architecture.md`: this provider is a pure
 * function over its input — no I/O, no side effects, no fetch.
 */

import {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
  flattenContent,
  llmOk,
} from './types';

export interface TestLlmSeed {
  /** Map from a stable digest of the request → canned response text. */
  responses?: Record<string, string>;
  /** Last user message text → canned response. Convenience overlay. */
  byLastUser?: Record<string, string>;
}

export class TestLlmProvider implements LlmProvider {
  readonly name = 'test' as const;
  private readonly responses: Map<string, string>;
  private readonly byLastUser: Map<string, string>;
  /** Public for tests — call log. */
  readonly calls: Array<{ request: LlmCompletionRequest }> = [];

  constructor(seed: TestLlmSeed = {}) {
    this.responses = new Map(Object.entries(seed.responses ?? {}));
    this.byLastUser = new Map(Object.entries(seed.byLastUser ?? {}));
  }

  async complete(request: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    this.calls.push({ request });
    const digest = digestRequest(request);
    const seeded = this.responses.get(digest);
    if (seeded) {
      return llmOk(wrap(seeded, request));
    }
    const lastUser = lastUserText(request);
    const byUser = this.byLastUser.get(lastUser);
    if (byUser) {
      return llmOk(wrap(byUser, request));
    }
    const heuristic = heuristicResponse(request);
    return llmOk(wrap(heuristic, request));
  }
}

/**
 * Stable digest for seeding. Concatenates system + every user/assistant
 * message text — small enough for human-readable test seed keys, stable
 * across runs.
 */
export function digestRequest(req: LlmCompletionRequest): string {
  return [
    req.system.trim(),
    ...req.messages.map((m) => `${m.role}:${flattenContent(m.content).trim()}`),
  ].join('\n---\n');
}

function lastUserText(req: LlmCompletionRequest): string {
  for (let i = req.messages.length - 1; i >= 0; i--) {
    if (req.messages[i].role === 'user') return flattenContent(req.messages[i].content).trim();
  }
  return '';
}

function wrap(text: string, req: LlmCompletionRequest): LlmCompletion {
  return {
    text,
    stopReason: 'end_turn',
    usage: {
      inputTokens: estimateTokens(req),
      outputTokens: estimateTokens({
        ...req,
        messages: [{ role: 'assistant', content: text }],
        system: '',
      }),
      // Cache flags are a no-op for the test provider: report 0 so any
      // downstream metrics surface still parses cleanly. The Anthropic
      // path is where real cache hits/writes get reported.
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
    model: req.model ?? 'test-stub',
  };
}

function estimateTokens(req: LlmCompletionRequest): number {
  const sysLen = req.system.length;
  const msgLen = req.messages.reduce(
    (sum, m) => sum + flattenContent(m.content).length,
    0,
  );
  const total = sysLen + msgLen;
  return Math.max(1, Math.ceil(total / 4));
}

// ── Heuristic rules ─────────────────────────────────────────────────────
//
// Each rule serves one skill's response shape. The skill code parses the
// response (`JSON.parse` for categorize/schedule/draft, plain text for
// coordinate). When the heuristic produces malformed JSON the skill's
// error path engages — which is exactly the production failure mode we
// want the e2e test to exercise.
//
// Rule routing is by system-prompt prefix; each skill stamps a unique
// prefix marker so the test provider can dispatch reliably. See
// `lib/skills/prompts/markers.ts`.

import {
  CATEGORIZE_PROMPT_MARKER,
  COORDINATE_PROMPT_MARKER,
  DRAFT_PROMPT_MARKER,
  OFFICE_ADMIN_PROMPT_MARKER,
  SCHEDULE_PROMPT_MARKER,
} from '../skills/prompts/markers';

function heuristicResponse(req: LlmCompletionRequest): string {
  const system = req.system;
  const userText = lastUserText(req).toLowerCase();
  if (system.includes(OFFICE_ADMIN_PROMPT_MARKER)) {
    return officeAdminHeuristic(userText);
  }
  if (system.includes(CATEGORIZE_PROMPT_MARKER)) {
    return categorizeHeuristic(userText, system);
  }
  if (system.includes(SCHEDULE_PROMPT_MARKER)) {
    return scheduleHeuristic(userText);
  }
  if (system.includes(DRAFT_PROMPT_MARKER)) {
    return draftHeuristic(userText, system);
  }
  if (system.includes(COORDINATE_PROMPT_MARKER)) {
    return coordinateHeuristic(userText);
  }
  return JSON.stringify({ note: 'no-heuristic-match' });
}

function officeAdminHeuristic(user: string): string {
  // Routing order matters — most specific first. Per
  // `feedback_integration_acceptance_is_functional.md`: the heuristic
  // must surface exactly the categorization signals that a real model
  // would land on so the test asserts the wiring, not a fixture choice.
  if (
    /(suspicious sign-?in|unusual sign-?in|new device|new sign-?in|account (?:locked|suspended)|security alert)/i.test(
      user,
    )
  ) {
    return JSON.stringify({
      category: 'account-suspension',
      confidence: 0.9,
      reason: 'security incident language detected (suspicious / new-device / account-locked)',
    });
  }
  if (/(reset (?:your )?password|set a new password|password reset)/i.test(user)) {
    return JSON.stringify({
      category: 'password-reset',
      confidence: 0.92,
      reason: 'explicit password-reset language with a reset link',
    });
  }
  if (/(verification code|security code|one-?time (?:code|password|pin)|otp|sign-?in code|your code is|\bcode:\s*\d{4,8}\b|\b\d{6}\b)/i.test(user)) {
    return JSON.stringify({
      category: 'verification-code',
      confidence: 0.88,
      reason: 'message carries a one-time code / 2FA code',
    });
  }
  if (/(verify (?:your )?(?:email|address)|confirm (?:your )?(?:email|address|sign-?up)|email verification|please verify)/i.test(user)) {
    return JSON.stringify({
      category: 'email-verification',
      confidence: 0.85,
      reason: 'explicit verify-email language',
    });
  }
  if (/(trial (?:ends?|expir|will expire)|free trial|subscription (?:ends?|expir|will renew)|renews on|cancel before|will be charged)/i.test(user)) {
    return JSON.stringify({
      category: 'trial-expiration',
      confidence: 0.83,
      reason: 'trial / renewal expiration language',
    });
  }
  if (
    /(invoice (?:attached|number|#|due|total)|payment failed|payment declined|card (?:expir|declined)|past[-\s]due (?:amount|invoice|balance)|amount due|billing notice|billing update|your invoice|receipt for your (?:purchase|payment|subscription)|payment receipt)/i.test(
      user,
    )
  ) {
    return JSON.stringify({
      category: 'billing-notice',
      confidence: 0.8,
      reason: 'billing / invoice / payment language',
    });
  }
  if (/(welcome to\s+|thanks? for (?:signing up|subscrib)|your subscription is (?:active|live|confirmed))/i.test(user)) {
    return JSON.stringify({
      category: 'subscription-confirmation',
      confidence: 0.78,
      reason: 'subscription-confirmed welcome language',
    });
  }
  if (/(scheduled maintenance|service (?:disruption|status|incident)|incident report|partial outage|degraded performance)/i.test(user)) {
    return JSON.stringify({
      category: 'service-status',
      confidence: 0.78,
      reason: 'service-status / maintenance language',
    });
  }
  if (/(email preferences|notification preferences|manage (?:your )?(?:email|notification) preferences|update your preferences|unsubscribe)/i.test(user)) {
    return JSON.stringify({
      category: 'email-preferences',
      confidence: 0.72,
      reason: 'email-preferences housekeeping language',
    });
  }
  return JSON.stringify({
    category: 'not-admin',
    confidence: 0.85,
    reason: 'no decisive admin signal — let vertical chain handle it',
  });
}

function categorizeHeuristic(user: string, system: string): string {
  // Noise wins first — marketing senders + Experian-shape alerts dominate
  // a realistic inbox. Per `feedback_integration_acceptance_is_functional.md`:
  // categorization must filter noise BEFORE attempting expensive downstream
  // skills (draft, schedule). Verticals override the noise default only
  // when their domain markers are present (see vertical prompts).
  const verticalSlug = extractVerticalSlug(system);
  // Noise patterns — model these on Conner's actual inbox shape per the
  // task brief (Pottery Barn, Redfin alerts, Experian, recruiters).
  if (
    user.includes('pottery barn') ||
    user.includes('unsubscribe-list') ||
    user.includes('redfin') ||
    user.includes('experian') ||
    user.includes('recruiter spam marker') ||
    user.includes('newsletter:') ||
    user.includes('promotional:')
  ) {
    return JSON.stringify({
      intent: 'noise',
      confidence: 0.92,
      reason: 'sender pattern matches marketing/promotional/alert noise; no business intent',
    });
  }
  // Transactional — automated / do-not-reply / receipt patterns must beat
  // scheduling and draft because the inbound is informational and has no
  // human counterparty to reply to.
  if (
    user.includes('do not reply') ||
    user.includes('do-not-reply') ||
    user.includes('noreply@') ||
    user.includes('this is an automated notification')
  ) {
    return JSON.stringify({
      intent: 'transactional',
      confidence: 0.88,
      reason: 'sender is an automated/no-reply endpoint; no draftable counterparty',
    });
  }
  // Vertical-divergence: a message that reads strongly as another
  // vertical's domain should categorize as `noise` for the current
  // workspace. This is the rule that makes the per-vertical prompt
  // architecture meaningful — same email, different verticals, different
  // routing. See `tests/skills-loop-e2e.test.ts` divergence assertion.
  const otherVerticalSignal = detectOtherVerticalSignal(user, verticalSlug);
  if (otherVerticalSignal) {
    return JSON.stringify({
      intent: 'noise',
      confidence: 0.74,
      reason: `message reads as ${otherVerticalSignal} domain; not relevant to ${verticalSlug} workspace`,
    });
  }
  // Scheduling intent — explicit verb + temporal anchor.
  if (
    (user.includes('schedule') ||
      user.includes('meeting') ||
      user.includes('available') ||
      user.includes('appointment') ||
      user.includes('walk-through') ||
      user.includes('showing') ||
      user.includes('consult')) &&
    !user.includes('rescheduled-confirmation')
  ) {
    return JSON.stringify({
      intent: 'scheduling-needed',
      confidence: 0.84,
      reason: 'message proposes a meeting or asks for a time without proposing one',
    });
  }
  // Draft-needed — direct question or explicit ask.
  if (
    user.includes('can you') ||
    user.includes('please') ||
    user.includes('question:') ||
    user.includes('?\n') ||
    user.endsWith('?') ||
    user.includes('need your input') ||
    user.includes('please review') ||
    user.includes('need a response')
  ) {
    return JSON.stringify({
      intent: 'draft-needed',
      confidence: 0.78,
      reason: 'inbound contains a direct ask requiring a written reply',
    });
  }
  // Lead — vertical-marker present and the message reads like an inquiry.
  if (
    user.includes('interested in') ||
    user.includes('inquiry') ||
    user.includes('looking for') ||
    user.includes('quote') ||
    user.includes('estimate')
  ) {
    return JSON.stringify({
      intent: 'lead',
      confidence: 0.71,
      reason: `inbound shows ${verticalSlug}-shaped inquiry language`,
    });
  }
  // Vendor — billing / invoice / receipt language.
  if (
    user.includes('invoice') ||
    user.includes('subscription renewal') ||
    user.includes('your account has been') ||
    user.includes('payment')
  ) {
    return JSON.stringify({
      intent: 'vendor',
      confidence: 0.75,
      reason: 'message is a vendor-side notification (billing/account)',
    });
  }
  // Transactional — system/automated confirmation.
  if (
    user.includes('confirmation') ||
    user.includes('your order') ||
    user.includes('receipt') ||
    user.includes('do not reply')
  ) {
    return JSON.stringify({
      intent: 'transactional',
      confidence: 0.82,
      reason: 'sender or content reads as automated/transactional',
    });
  }
  return JSON.stringify({
    intent: 'noise',
    confidence: 0.51,
    reason: 'no business intent detected; default to noise to avoid false positives',
  });
}

function scheduleHeuristic(user: string): string {
  // Extract a coarse proposal — if the inbound mentions a day-of-week or
  // morning/afternoon, propose two slots that respect business hours.
  const businessDayHint = /\b(monday|tuesday|wednesday|thursday|friday)\b/i.exec(user);
  const day = businessDayHint?.[1]?.toLowerCase() ?? 'wednesday';
  const morningPreferred = user.includes('morning');
  const proposal = {
    needsResponse: true,
    proposedSlots: morningPreferred
      ? [
          { day, startLocal: '09:30', endLocal: '10:00' },
          { day, startLocal: '10:30', endLocal: '11:00' },
        ]
      : [
          { day, startLocal: '14:00', endLocal: '14:30' },
          { day, startLocal: '15:30', endLocal: '16:00' },
        ],
    reasoning:
      'Proposed two business-hour slots on the day the sender hinted at, leaving buffer between meetings.',
    confidence: 0.66,
  };
  return JSON.stringify(proposal);
}

function draftHeuristic(user: string, system: string): string {
  // Echo back the simplest possible draft that a human can review.
  // Tone defaults to "casual" except in CPA/law/insurance where the
  // vertical prompt asks for "formal".
  const verticalSlug = extractVerticalSlug(system);
  const formalVerticals = ['cpa', 'law', 'insurance', 'ria', 'title-escrow'];
  const tone = formalVerticals.includes(verticalSlug) ? 'formal' : 'casual';
  const subject = pickSubject(user);
  const greeting = tone === 'formal' ? 'Hello,' : 'Hi,';
  const closer = tone === 'formal' ? 'Best regards,' : 'Thanks,';
  // Voice match — the prod prompt (lib/skills/prompts/shared.ts + the
  // WORKSPACE FILE CONTEXT block in lib/customer-files/render.ts) now
  // instructs the model to follow the broker-owner's own examples and
  // cite at least one. The heuristic models that behavior so the e2e
  // can assert the loop deterministically: when a file-context block is
  // present, cite the first example's title and echo a phrase from it.
  // Per feedback_integration_acceptance_is_functional.md the test
  // provider must surface the same wiring a real model would.
  const example = extractFirstFileContext(system);
  if (example) {
    const echo = example.phrase ? ` Following our usual note: “${example.phrase}”.` : '';
    return JSON.stringify({
      subject,
      body: `${greeting}\n\nThanks for the note.${echo} I drew on your “${example.title}” to keep this in your voice, and I'll follow up with specifics shortly.\n\n${closer}`,
      tone,
      confidence: 0.6,
    });
  }
  // Avoid over-promising — the body acknowledges receipt + signals next step
  // rather than committing to specifics the human hasn't approved.
  return JSON.stringify({
    subject,
    body: `${greeting}\n\nThanks for the note. I'll review and respond with specifics shortly.\n\n${closer}`,
    tone,
    confidence: 0.55,
  });
}

/**
 * Pull the first snippet's title (+ a short phrase from its body) out of
 * a rendered WORKSPACE FILE CONTEXT block. The render format (see
 * `lib/customer-files/render.ts`) opens each snippet with a line:
 *
 *   — <title> (similarity=0.87; <url>)
 *   <body…>
 *
 * Returns null when no file-context block is present (fresh workspace,
 * no ingested files) so the caller falls back to the generic draft.
 */
function extractFirstFileContext(
  system: string,
): { title: string; phrase: string | null } | null {
  if (!system.includes('WORKSPACE FILE CONTEXT')) return null;
  const lines = system.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Snippet header lines start with the em-dash bullet "— " and carry
    // a "(similarity=" marker. The directive bullets use "  • " so they
    // never match here.
    const m = /^—\s+(.+?)\s+\(similarity=/.exec(line);
    if (m) {
      const title = m[1].trim().slice(0, 80);
      const body = (lines[i + 1] ?? '').trim();
      const phrase = body.length > 0 ? body.split(/(?<=[.!?])\s/)[0].slice(0, 80) : null;
      return { title, phrase };
    }
  }
  return null;
}

function coordinateHeuristic(user: string): string {
  // Coordinate skill expects plain text, not JSON. Return a short
  // ThreadContext summary marker the skill can parse.
  return `THREAD_SUMMARY: ${user.slice(0, 200)}\nREFERENCES: []\nCROSS_THREAD: []`;
}

function pickSubject(user: string): string {
  const re = /subject:\s*(.+?)(\n|$)/i;
  const m = re.exec(user);
  if (m) return `Re: ${m[1].trim().slice(0, 80)}`;
  return 'Re: Following up';
}

function extractVerticalSlug(system: string): string {
  const m = /VERTICAL_SLUG:\s*([\w-]+)/.exec(system);
  return m?.[1] ?? 'real-estate';
}

/**
 * If the user message reads strongly as another vertical's domain,
 * return that vertical's name so the categorize heuristic can demote
 * to `noise` for the current workspace. Only fires when the OTHER
 * vertical's signal is unambiguous — keeps the rule from accidentally
 * demoting messages that incidentally mention a foreign-domain word.
 */
function detectOtherVerticalSignal(user: string, currentSlug: string): string | null {
  // Strong CPA / tax-domain markers
  if (
    currentSlug !== 'cpa' &&
    (user.includes('tax-prep') ||
      user.includes(' 1040') ||
      user.includes('k-1') ||
      user.includes('cp2000') ||
      user.includes(' irs '))
  ) {
    return 'cpa';
  }
  // Strong title/escrow markers
  if (
    currentSlug !== 'title-escrow' &&
    (user.includes('title commitment') ||
      user.includes('wire instructions') ||
      user.includes('curative item'))
  ) {
    return 'title-escrow';
  }
  // Strong law markers
  if (
    currentSlug !== 'law' &&
    (user.includes('motion to compel') ||
      user.includes('meet and confer') ||
      user.includes('case 2026-cv'))
  ) {
    return 'law';
  }
  return null;
}
