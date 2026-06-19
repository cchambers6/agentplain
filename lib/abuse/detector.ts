/**
 * lib/abuse/detector.ts
 *
 * Abuse + IP-extraction detection. Pure, dependency-free pattern matchers so
 * the whole module is unit-testable without a database, an LLM, or a request
 * context. Callers (the chat route, the connector dispatch layer, the
 * access-audit sink, the auto-suspend decider) feed in already-collected
 * evidence and read back a list of `AbuseSignal`s.
 *
 * Four detection families, mapped to the Acceptable Use Policy:
 *   1. PROMPT_EXTRACTION — attempts to pull our system prompts, skill
 *      definitions, or Plaino's internal orchestration logic out via chat.
 *   2. SCRAPING          — automated harvesting of the marketplace, knowledge
 *      corpora, or product copy (rapid fetches, headless/bot user agents).
 *   3. ACCOUNT_CHURN     — sign-up → max usage → cancel → repeat with a new
 *      email, to farm free-trial capacity.
 *   4. PROBING           — high-frequency identical queries hammering one
 *      surface (capacity abuse / model fingerprinting).
 *
 * Design rules (per the project memory):
 *   - `feedback_cold_start_safe_agents`: no hidden state. Every detector is a
 *     pure function of its inputs; persistence lives in `lib/abuse/suspend.ts`
 *     and `lib/observability/access-audit.ts`.
 *   - Evidence is REDACTED. We surface the matched *rule* and a short keyword
 *     excerpt, never the customer's full message. The detector never logs or
 *     returns raw chat bodies.
 *   - Detection is advisory. Nothing here suspends an account; it produces
 *     signals. `suspend.ts` owns the consequence, and a human (Conner) confirms
 *     a hard suspend. This keeps a false positive from locking a paying
 *     customer out of their own data.
 */

// ── Public types ─────────────────────────────────────────────────────────

export type AbuseCategory =
  | 'PROMPT_EXTRACTION'
  | 'SCRAPING'
  | 'ACCOUNT_CHURN'
  | 'PROBING';

export type AbuseSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

/** What the downstream layer should do with this signal. The suspend decider
 *  reads `recommendedAction`; it may still escalate or de-escalate based on
 *  accumulated history. */
export type RecommendedAction = 'LOG' | 'FLAG' | 'SOFT_SUSPEND';

export interface AbuseSignal {
  category: AbuseCategory;
  severity: AbuseSeverity;
  /** The rule id that fired — stable, used for tuning + audit grouping. */
  rule: string;
  /** Human-readable reason, safe to store in an audit row (no raw PII). */
  reason: string;
  /** A short redacted excerpt of what matched. Never the full payload. */
  evidence?: string;
  recommendedAction: RecommendedAction;
}

const SEVERITY_RANK: Record<AbuseSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

/** Highest severity in a signal list, or null when empty. */
export function worstSeverity(signals: AbuseSignal[]): AbuseSeverity | null {
  let worst: AbuseSeverity | null = null;
  for (const s of signals) {
    if (worst === null || SEVERITY_RANK[s.severity] > SEVERITY_RANK[worst]) {
      worst = s.severity;
    }
  }
  return worst;
}

/** The strongest recommended action across a signal list. */
export function strongestAction(
  signals: AbuseSignal[],
): RecommendedAction | null {
  const rank: Record<RecommendedAction, number> = {
    LOG: 1,
    FLAG: 2,
    SOFT_SUSPEND: 3,
  };
  let best: RecommendedAction | null = null;
  for (const s of signals) {
    if (best === null || rank[s.recommendedAction] > rank[best]) {
      best = s.recommendedAction;
    }
  }
  return best;
}

// ── 1. Prompt-extraction patterns ────────────────────────────────────────

interface ExtractionRule {
  id: string;
  /** Matched against the normalized (lowercased, whitespace-collapsed) text. */
  pattern: RegExp;
  severity: AbuseSeverity;
  reason: string;
  recommendedAction: RecommendedAction;
}

/**
 * Prompt-extraction + jailbreak patterns. These target our IP directly: the
 * vertical playbook system prompts, the skill definitions, and Plaino's
 * orchestration logic. A single match is a FLAG (logged for review); the
 * suspend decider escalates on repetition.
 *
 * Kept deliberately conservative — these phrases have very low legitimate-use
 * overlap with a local-business owner asking Plaino to do real work. A realtor
 * asking "draft a reply to this offer" trips none of them.
 */
const EXTRACTION_RULES: readonly ExtractionRule[] = [
  {
    id: 'system-prompt-verbatim',
    pattern:
      /\b(repeat|print|output|show|reveal|display|echo|dump)\b.{0,40}\b(system|initial|original|above|preceding|developer)\b.{0,20}\b(prompt|instruction|message|text)\b/,
    severity: 'HIGH',
    reason: 'Request to reveal the system prompt / initial instructions verbatim.',
    recommendedAction: 'FLAG',
  },
  {
    id: 'ignore-previous-instructions',
    pattern:
      /\b(ignore|disregard|forget|override|bypass)\b.{0,30}\b(previous|prior|above|earlier|all|your)\b.{0,20}\b(instruction|prompt|rule|direction|guardrail)/,
    severity: 'HIGH',
    reason: 'Instruction-override / jailbreak attempt.',
    recommendedAction: 'FLAG',
  },
  {
    id: 'reveal-instructions',
    pattern:
      /\b(what|tell me|describe|list)\b.{0,30}\b(your|the)\b.{0,20}\b(exact|verbatim|full|complete|underlying)?\s*(system\s*prompt|instructions|guidelines|rules you|directives)\b/,
    severity: 'MEDIUM',
    reason: 'Probing for the underlying instruction set.',
    recommendedAction: 'FLAG',
  },
  {
    id: 'skill-definition-extraction',
    pattern:
      /\b(show|reveal|print|output|dump|export|give me)\b.{0,40}\b(skill|agent|playbook|workflow|orchestrat|tool)\b.{0,20}\b(definition|config|configuration|source|yaml|json|spec|prompt|logic)\b/,
    severity: 'HIGH',
    reason: 'Attempt to extract skill / agent / orchestration definitions.',
    recommendedAction: 'FLAG',
  },
  {
    id: 'roleplay-override',
    pattern:
      /\b(you are now|pretend you are|act as|from now on you|enter)\b.{0,40}\b(dan|do anything now|developer mode|jailbreak|unrestricted|no rules|without (any )?(restrictions|guardrails|filters))\b/,
    severity: 'HIGH',
    reason: 'Persona-override jailbreak (DAN / developer-mode style).',
    recommendedAction: 'FLAG',
  },
  {
    id: 'print-text-above',
    pattern:
      /\b(print|repeat|output|spell out)\b.{0,20}\b(everything|all the text|the text|the words)\b.{0,20}\b(above|before this|so far|in this conversation)\b/,
    severity: 'MEDIUM',
    reason: 'Attempt to dump the prior context window verbatim.',
    recommendedAction: 'FLAG',
  },
  {
    id: 'model-fingerprint',
    pattern:
      /\b(what (model|llm|version) (are you|powers you|do you run)|which (model|llm)|are you (gpt|claude|gemini|llama)|reveal your (model|underlying model|provider))\b/,
    severity: 'LOW',
    reason: 'Model-fingerprinting probe.',
    recommendedAction: 'LOG',
  },
];

/** Collapse whitespace + lowercase so patterns are robust to spacing tricks. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Short redacted excerpt around the matched span — keyword-only, never the
 *  full message. Caps at 80 chars. */
function redactedExcerpt(normalized: string, match: RegExpMatchArray): string {
  const idx = match.index ?? 0;
  const raw = normalized.slice(idx, idx + 80);
  return raw.length < 80 ? raw : `${raw}…`;
}

/**
 * Scan a single chat message (or any free text) for prompt-extraction /
 * jailbreak patterns. Returns one signal per matched rule. Empty array = clean.
 */
export function detectPromptExtraction(text: string): AbuseSignal[] {
  if (!text || text.length === 0) return [];
  const normalized = normalizeText(text);
  const out: AbuseSignal[] = [];
  for (const rule of EXTRACTION_RULES) {
    const match = normalized.match(rule.pattern);
    if (match) {
      out.push({
        category: 'PROMPT_EXTRACTION',
        severity: rule.severity,
        rule: rule.id,
        reason: rule.reason,
        evidence: redactedExcerpt(normalized, match),
        recommendedAction: rule.recommendedAction,
      });
    }
  }
  return out;
}

// ── 2. Scraping detection ────────────────────────────────────────────────

export interface PageFetchEvent {
  /** Path requested. Used only for counting; not stored as evidence. */
  path: string;
  /** Epoch ms of the request. */
  at: number;
  /** Raw user-agent header, if any. */
  userAgent?: string | null;
  /** Whether the request carried a browser-like Accept header. */
  acceptsHtml?: boolean;
}

export interface ScrapingOptions {
  /** Sliding window for the rate check. Default 60s. */
  windowMs?: number;
  /** Fetches within the window above which we flag. Default 120 (2/s sustained). */
  maxFetchesPerWindow?: number;
}

/** User-agent substrings that indicate automation rather than a browser.
 *  An empty UA is also treated as automation. */
const BOT_UA_MARKERS = [
  'headless',
  'puppeteer',
  'playwright',
  'phantomjs',
  'selenium',
  'scrapy',
  'python-requests',
  'python-urllib',
  'go-http-client',
  'node-fetch',
  'axios/',
  'curl/',
  'wget/',
  'libwww',
  'httpclient',
  'bot',
  'spider',
  'crawler',
];

function looksLikeBot(userAgent: string | null | undefined): string | null {
  if (userAgent == null || userAgent.trim().length === 0) {
    return 'empty-user-agent';
  }
  const ua = userAgent.toLowerCase();
  for (const marker of BOT_UA_MARKERS) {
    if (ua.includes(marker)) return marker;
  }
  return null;
}

/**
 * Detect scraping behaviour from a batch of recent page fetches for one
 * account / IP. Two independent signals:
 *   - sustained high fetch rate (rapid page harvesting), and
 *   - automation user agents (headless browsers, HTTP libraries).
 */
export function detectScraping(
  events: PageFetchEvent[],
  opts: ScrapingOptions = {},
): AbuseSignal[] {
  if (events.length === 0) return [];
  const windowMs = opts.windowMs ?? 60_000;
  const maxFetches = opts.maxFetchesPerWindow ?? 120;
  const out: AbuseSignal[] = [];

  // Rate: max fetches in any sliding window. Sort by time, slide.
  const times = events.map((e) => e.at).sort((a, b) => a - b);
  let peak = 0;
  let start = 0;
  for (let end = 0; end < times.length; end++) {
    while (times[end] - times[start] > windowMs) start++;
    peak = Math.max(peak, end - start + 1);
  }
  if (peak > maxFetches) {
    out.push({
      category: 'SCRAPING',
      severity: peak > maxFetches * 3 ? 'HIGH' : 'MEDIUM',
      rule: 'fetch-rate',
      reason: `Sustained fetch rate ${peak} requests / ${Math.round(
        windowMs / 1000,
      )}s exceeds the ${maxFetches} ceiling.`,
      recommendedAction: peak > maxFetches * 3 ? 'SOFT_SUSPEND' : 'FLAG',
    });
  }

  // Automation user agents. Count distinct bot markers across the batch.
  const markers = new Set<string>();
  for (const e of events) {
    const marker = looksLikeBot(e.userAgent);
    if (marker) markers.add(marker);
  }
  // Only flag if automation is the DOMINANT pattern (most fetches are bot-ish)
  // — a single odd UA is noise, not abuse.
  const botCount = events.filter((e) => looksLikeBot(e.userAgent)).length;
  if (botCount > 0 && botCount >= Math.ceil(events.length * 0.5)) {
    out.push({
      category: 'SCRAPING',
      severity: 'MEDIUM',
      rule: 'automation-user-agent',
      reason: `Automation user agent on ${botCount}/${events.length} requests (${[
        ...markers,
      ].join(', ')}).`,
      evidence: [...markers].slice(0, 5).join(', '),
      recommendedAction: 'FLAG',
    });
  }

  return out;
}

// ── 3. Account-churn detection ───────────────────────────────────────────

export interface AccountEpisode {
  /** Opaque per-account id (workspace id). Not PII. */
  accountId: string;
  /** When the account was created (epoch ms). */
  createdAt: number;
  /** When it cancelled/closed (epoch ms), or null if still open. */
  cancelledAt: number | null;
  /** A coarse usage measure during the episode (e.g. LLM calls, % of cap). */
  usage: number;
  /** A stable fingerprint that ties churned accounts together — a hash of
   *  IP / device / payment instrument. Never the raw value. */
  fingerprint: string;
}

export interface AccountChurnOptions {
  /** Episodes sharing a fingerprint above which we flag. Default 3. */
  minEpisodes?: number;
  /** Episode lifespan under which it counts as "burned fast" (ms). Default 14d. */
  shortLifespanMs?: number;
  /** Usage above which the short episode counts as "maxed". Default 80. */
  highUsage?: number;
}

/**
 * Detect the trial-farming loop: the same actor (by fingerprint) spinning up
 * an account, maxing free-trial usage, cancelling, and repeating under a new
 * email. We group episodes by fingerprint and flag fingerprints with several
 * short, high-usage, cancelled episodes.
 */
export function detectAccountChurn(
  episodes: AccountEpisode[],
  opts: AccountChurnOptions = {},
): AbuseSignal[] {
  const minEpisodes = opts.minEpisodes ?? 3;
  const shortLifespan = opts.shortLifespanMs ?? 14 * 24 * 60 * 60 * 1000;
  const highUsage = opts.highUsage ?? 80;

  const byFingerprint = new Map<string, AccountEpisode[]>();
  for (const ep of episodes) {
    const list = byFingerprint.get(ep.fingerprint) ?? [];
    list.push(ep);
    byFingerprint.set(ep.fingerprint, list);
  }

  const out: AbuseSignal[] = [];
  for (const [fingerprint, list] of byFingerprint) {
    const burned = list.filter((ep) => {
      if (ep.cancelledAt == null) return false;
      const lifespan = ep.cancelledAt - ep.createdAt;
      return lifespan <= shortLifespan && ep.usage >= highUsage;
    });
    if (burned.length >= minEpisodes) {
      out.push({
        category: 'ACCOUNT_CHURN',
        severity: burned.length >= minEpisodes * 2 ? 'HIGH' : 'MEDIUM',
        rule: 'trial-farming',
        reason: `${burned.length} short, high-usage accounts share fingerprint ${fingerprint.slice(
          0,
          8,
        )}… — trial-farming pattern.`,
        evidence: `${fingerprint.slice(0, 8)}…`,
        recommendedAction: 'FLAG',
      });
    }
  }
  return out;
}

// ── 4. Probing detection ─────────────────────────────────────────────────

export interface TimedQuery {
  /** The query text. Normalized internally for comparison. */
  text: string;
  /** Epoch ms. */
  at: number;
}

export interface ProbingOptions {
  /** Sliding window. Default 5 minutes. */
  windowMs?: number;
  /** Identical-query repetitions within the window above which we flag.
   *  Default 30. */
  maxIdenticalPerWindow?: number;
}

/**
 * Detect probing: the same normalized query fired many times in a short window
 * — capacity abuse or systematic model fingerprinting. Distinct from a customer
 * legitimately re-running a workflow (those queries vary).
 */
export function detectProbing(
  queries: TimedQuery[],
  opts: ProbingOptions = {},
): AbuseSignal[] {
  if (queries.length === 0) return [];
  const windowMs = opts.windowMs ?? 5 * 60_000;
  const maxIdentical = opts.maxIdenticalPerWindow ?? 30;

  // Group by normalized text, then find the peak identical-count in any window.
  const byText = new Map<string, number[]>();
  for (const q of queries) {
    const key = normalizeText(q.text);
    if (key.length === 0) continue;
    const list = byText.get(key) ?? [];
    list.push(q.at);
    byText.set(key, list);
  }

  const out: AbuseSignal[] = [];
  for (const [key, times] of byText) {
    times.sort((a, b) => a - b);
    let peak = 0;
    let start = 0;
    for (let end = 0; end < times.length; end++) {
      while (times[end] - times[start] > windowMs) start++;
      peak = Math.max(peak, end - start + 1);
    }
    if (peak > maxIdentical) {
      out.push({
        category: 'PROBING',
        severity: peak > maxIdentical * 3 ? 'HIGH' : 'MEDIUM',
        rule: 'identical-query-flood',
        reason: `Identical query repeated ${peak} times within ${Math.round(
          windowMs / 60_000,
        )} min — probing pattern.`,
        evidence: key.slice(0, 60),
        recommendedAction: peak > maxIdentical * 3 ? 'SOFT_SUSPEND' : 'FLAG',
      });
    }
  }
  return out;
}

// ── Convenience: full chat-message scan ──────────────────────────────────

/**
 * The single entry point the chat route calls per inbound message. Today it
 * runs prompt-extraction detection on the message body; probing + churn need
 * cross-message history and are evaluated by the access-audit roll-up. Kept as
 * one function so the call site is stable as we add per-message checks.
 */
export function scanChatMessage(text: string): AbuseSignal[] {
  return detectPromptExtraction(text);
}
