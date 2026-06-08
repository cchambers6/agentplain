/**
 * lib/skills/pre-call-brief/types.ts
 *
 * Pre-call brief skill (wave-5, pride theme #15 / ratif #10). The
 * `b2b-sales-rep` skill description already promises a "30-min pre-call
 * brief"; before this it had no runtime — the cron was a `pending-runner-port`
 * stub. This skill auto-generates a SHORT, personalized 5-bullet brief just
 * before each intro call so the rep walks in prepared.
 *
 * Provider-neutral by contract:
 *   - Upcoming calls come from the calendar PORT (CalendarEventDto), not the
 *     Google SDK.
 *   - Prospect grounding comes from the research substrate PORT (web search
 *     when wired, fixture corpus otherwise) — same `IResearchSubstratePort`
 *     the research-on-demand skill uses. Per `feedback_no_silent_vendor_lock`.
 *
 * Per `project_no_outbound_architecture.md`: the brief is a working document
 * the rep reads. It is NOT sent anywhere.
 */

import type { SkillResult } from '../types';
import type { IResearchSubstratePort } from '../research-on-demand-general';
import type { LlmProvider } from '../../llm/types';

/** The minimal shape the skill needs about an upcoming intro call. Mirrors
 *  `CalendarEventDto` so the caller can pass calendar events directly. */
export interface UpcomingCall {
  /** Stable id (calendar event id) — used to dedupe + tag the brief. */
  id: string;
  /** Event title, e.g. "Intro call — Acme Realty (Jane Doe)". The prospect
   *  name is parsed out of this for grounding. */
  title: string;
  /** ISO 8601 UTC start instant. */
  startUtc: string;
  /** Optional free-text the caller already has (event description /
   *  attendee notes). Folded into the grounding query when present. */
  context?: string;
}

export interface PreCallBrief {
  callId: string;
  /** Prospect / company the brief is about (best-effort parse of the title). */
  subject: string;
  /** ISO start instant echoed back for the rep. */
  startUtc: string;
  /** EXACTLY 5 bullets — the load-bearing contract (theme #15). */
  bullets: string[];
  /** Sources the bullets are grounded on (web search / knowledge base).
   *  Empty when grounding returned nothing — the brief says so in a bullet. */
  citations: Array<{ title: string; sourceUrl: string | null }>;
  /** Whether grounding was live web search vs fixture/empty. */
  groundingIsLive: boolean;
}

export interface PreCallBriefInput {
  call: UpcomingCall;
  /** Substrate that grounds the brief. Production binds
   *  WebSearchResearchSubstrate; tests bind RecordingResearchSubstrate. */
  substrate: IResearchSubstratePort;
  /** Whether the substrate grounds on live web sources. */
  groundingIsLive?: boolean;
  /** Workspace id for the substrate query scope. For the internal GTM
   *  fleet this is the internal workspace; the field is required so the
   *  substrate stays workspace-scoped. */
  workspaceId: string;
  /** Cap on grounding snippets. Default 4. */
  topK?: number;
  /** Optional LLM override. Defaults to getLlmProvider(). */
  llm?: LlmProvider;
}

export type PreCallBriefResult = SkillResult<PreCallBrief>;

export const PRE_CALL_BRIEF_SLUG = 'pre-call-brief';
