/**
 * Leadership-board data layer.
 *
 * The leadership board surfaces one question: did each leadership-tier
 * agent fire today, and what did it do?
 *
 * Per `feedback_runner_portability.md` + `feedback_no_silent_vendor_lock.md`:
 * the page consumes data only through `LeadershipDataSource`. Today the
 * snapshot-backed implementation in `leadership-data-snapshot.ts` reads a
 * JSON file checked into `public/leadership-snapshot.json` (refreshed by
 * `scripts/snapshot-leadership-state.ts`). When the AgentRunLog DB table
 * lands, a second implementation (`leadership-data-db.ts`) drops in
 * without touching the page or the classifier.
 *
 * Per `feedback_no_guesses_no_estimates.md`: every status derives from a
 * concrete observation on a snapshot entry (`lastFiredAt`, `lastError`).
 * Agents with no observation surface as `NotYetFired`, never
 * extrapolated as Healthy.
 *
 * Per `feedback_everything_tells_a_story.md`: the roster, classifier,
 * and counter shapes encode the same arc the page renders — what the
 * agent is, when it should fire, when it last fired, what it did, what
 * is blocked.
 */

export type LeadershipTier = "A" | "B" | "C" | "1" | "1.5";

export interface LeadershipAgent {
  id: string;
  displayName: string;
  tier: LeadershipTier;
  /** Human-readable schedule (e.g. "06:00 ET daily"). */
  cronScheduleLabel: string;
  /**
   * Expected interval between fires in milliseconds. The classifier
   * marks an agent Stuck when `now - lastFiredAt > cronCadenceMs +
   * STUCK_GRACE_MS`.
   */
  cronCadenceMs: number;
}

export interface AgentRecommendationRef {
  id: string;
  status: "PROPOSED" | "ADOPTED" | "REJECTED" | "EXPIRED" | string;
  title: string;
  recordedAt: string;
}

export interface AgentEscalationRef {
  title: string;
  recordedAt: string;
}

export interface AgentObservation {
  agentId: string;
  lastFiredAt: string | null;
  lastFireSummary: string | null;
  lastError: string | null;
  latestRecommendation: AgentRecommendationRef | null;
  latestEscalation: AgentEscalationRef | null;
}

export interface LeadershipSnapshot {
  generatedAt: string;
  source: "flatsbo-repo" | "empty" | "manual" | "db";
  observations: AgentObservation[];
}

export interface LeadershipDataSource {
  /** Returns the most recent snapshot, plus the metadata needed to render
   *  the "last refreshed" timestamp on the page header. */
  load(): Promise<LeadershipSnapshot>;
}

// ---------------------------------------------------------------------------
// Roster — the agents the board displays. Order within a tier is the order
// the spec lists them; do not re-order without updating the spec.
// ---------------------------------------------------------------------------

const DAILY_MS = 24 * 60 * 60 * 1000;
const HOURLY_MS = 60 * 60 * 1000;

export const STUCK_GRACE_MS = 30 * 60 * 1000;

export const LEADERSHIP_ROSTER: readonly LeadershipAgent[] = [
  // Class A — CEOs
  {
    id: "flatsbo-ceo",
    displayName: "flatsbo-ceo",
    tier: "A",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "b2b-ceo",
    displayName: "b2b-ceo",
    tier: "A",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },

  // Class B — Cross-functional orchestrators
  {
    id: "chief-of-staff",
    displayName: "chief-of-staff",
    tier: "B",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "capability-builder",
    displayName: "capability-builder",
    tier: "B",
    cronScheduleLabel: "every 3h",
    cronCadenceMs: 3 * HOURLY_MS,
  },

  // Class C — Shared services
  {
    id: "agentplain-knowledge-architect",
    displayName: "agentplain-knowledge-architect",
    tier: "C",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },

  // Tier 1 — Directors / Tech-leads
  {
    id: "flatsbo-tech-lead",
    displayName: "flatsbo-tech-lead",
    tier: "1",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "flatsbo-eng-tech-lead",
    displayName: "flatsbo-eng-tech-lead",
    tier: "1",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "b2b-eng-tech-lead",
    displayName: "b2b-eng-tech-lead",
    tier: "1",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "platform-eng",
    displayName: "platform-eng",
    tier: "1",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "b2b-client-service-director",
    displayName: "b2b-client-service-director",
    tier: "1",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "flatsbo-b2b-sales-director",
    displayName: "flatsbo-b2b-sales-director",
    tier: "1",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },

  // Tier 1.5 — Vertical heads
  {
    id: "vertical-head-real-estate",
    displayName: "vertical-head-real-estate",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-mortgage",
    displayName: "vertical-head-mortgage",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-insurance",
    displayName: "vertical-head-insurance",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-property-management",
    displayName: "vertical-head-property-management",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-title-escrow",
    displayName: "vertical-head-title-escrow",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-recruiting",
    displayName: "vertical-head-recruiting",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-home-services",
    displayName: "vertical-head-home-services",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-cpa",
    displayName: "vertical-head-cpa",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-law",
    displayName: "vertical-head-law",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
  {
    id: "vertical-head-ria",
    displayName: "vertical-head-ria",
    tier: "1.5",
    cronScheduleLabel: "06:00 ET daily",
    cronCadenceMs: DAILY_MS,
  },
] as const;

export const TIER_LABELS: Record<LeadershipTier, string> = {
  A: "Class A — CEOs",
  B: "Class B — Cross-functional orchestrators",
  C: "Class C — Shared services",
  "1": "Tier 1 — Directors / Tech-leads",
  "1.5": "Tier 1.5 — Vertical heads",
};

export const TIER_ORDER: readonly LeadershipTier[] = ["A", "B", "C", "1", "1.5"];

// ---------------------------------------------------------------------------
// Classification — pure logic. Inputs: roster entry + observation + now.
// Outputs: an enum status the page renders as a badge.
// ---------------------------------------------------------------------------

export type AgentStatus = "Healthy" | "Stuck" | "Errored" | "NotYetFired";

export function classifyAgent(
  agent: LeadershipAgent,
  observation: AgentObservation | null,
  now: Date,
): AgentStatus {
  // No observation at all (e.g. fresh deploy, agent never invoked).
  if (!observation || observation.lastFiredAt === null) {
    return "NotYetFired";
  }
  if (observation.lastError) {
    return "Errored";
  }
  const last = Date.parse(observation.lastFiredAt);
  if (Number.isNaN(last)) {
    // Malformed timestamps from upstream are treated as "no observation"
    // so the page never claims Healthy without a real read.
    return "NotYetFired";
  }
  const overdueBy = now.getTime() - last;
  if (overdueBy > agent.cronCadenceMs + STUCK_GRACE_MS) {
    return "Stuck";
  }
  return "Healthy";
}

export interface BoardRow {
  agent: LeadershipAgent;
  observation: AgentObservation | null;
  status: AgentStatus;
}

export interface BoardTier {
  tier: LeadershipTier;
  label: string;
  rows: BoardRow[];
}

export interface BoardSummary {
  firedInLast24h: number;
  totalAgents: number;
  pendingConnerAction: number;
  stuck: number;
  healthy: number;
}

export interface ClassifiedBoard {
  generatedAt: string;
  source: LeadershipSnapshot["source"];
  tiers: BoardTier[];
  summary: BoardSummary;
}

export function classifyBoard(
  snapshot: LeadershipSnapshot,
  now: Date,
): ClassifiedBoard {
  const byAgent = new Map(snapshot.observations.map((o) => [o.agentId, o]));
  const rows: BoardRow[] = LEADERSHIP_ROSTER.map((agent) => {
    const observation = byAgent.get(agent.id) ?? null;
    return {
      agent,
      observation,
      status: classifyAgent(agent, observation, now),
    };
  });

  const tiers: BoardTier[] = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABELS[tier],
    rows: rows.filter((r) => r.agent.tier === tier),
  }));

  const twentyFourHAgo = now.getTime() - DAILY_MS;
  let firedInLast24h = 0;
  let pendingConnerAction = 0;
  let stuck = 0;
  let healthy = 0;
  for (const row of rows) {
    const last = row.observation?.lastFiredAt
      ? Date.parse(row.observation.lastFiredAt)
      : NaN;
    if (!Number.isNaN(last) && last >= twentyFourHAgo) {
      firedInLast24h += 1;
    }
    if (row.observation?.latestRecommendation?.status === "PROPOSED") {
      pendingConnerAction += 1;
    }
    if (row.status === "Stuck") stuck += 1;
    if (row.status === "Healthy") healthy += 1;
  }

  return {
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    tiers,
    summary: {
      firedInLast24h,
      totalAgents: rows.length,
      pendingConnerAction,
      stuck,
      healthy,
    },
  };
}

// ---------------------------------------------------------------------------
// Snapshot validation — every payload that crosses the boundary goes through
// this. Returns a normalized snapshot or throws with a descriptive error.
// Defensive parsing protects the page from a half-written file or stale
// shape from an older snapshot script.
// ---------------------------------------------------------------------------

export function parseSnapshot(payload: unknown): LeadershipSnapshot {
  if (!payload || typeof payload !== "object") {
    throw new Error("snapshot payload is not an object");
  }
  const obj = payload as Record<string, unknown>;
  const generatedAt = obj.generatedAt;
  if (typeof generatedAt !== "string" || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("snapshot.generatedAt missing or not ISO-8601");
  }
  const sourceCandidate = obj.source;
  const source =
    sourceCandidate === "flatsbo-repo" ||
    sourceCandidate === "empty" ||
    sourceCandidate === "manual" ||
    sourceCandidate === "db"
      ? sourceCandidate
      : "manual";
  const rawObservations = Array.isArray(obj.observations) ? obj.observations : [];
  const observations: AgentObservation[] = rawObservations
    .map((entry): AgentObservation | null => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Record<string, unknown>;
      if (typeof e.agentId !== "string") return null;
      return {
        agentId: e.agentId,
        lastFiredAt: typeof e.lastFiredAt === "string" ? e.lastFiredAt : null,
        lastFireSummary:
          typeof e.lastFireSummary === "string" ? e.lastFireSummary : null,
        lastError: typeof e.lastError === "string" ? e.lastError : null,
        latestRecommendation: parseRecommendation(e.latestRecommendation),
        latestEscalation: parseEscalation(e.latestEscalation),
      };
    })
    .filter((o): o is AgentObservation => o !== null);

  return { generatedAt, source, observations };
}

function parseRecommendation(raw: unknown): AgentRecommendationRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.title !== "string") return null;
  if (typeof r.recordedAt !== "string") return null;
  return {
    id: r.id,
    status: typeof r.status === "string" ? r.status : "PROPOSED",
    title: r.title,
    recordedAt: r.recordedAt,
  };
}

function parseEscalation(raw: unknown): AgentEscalationRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== "string" || typeof r.recordedAt !== "string") return null;
  return { title: r.title, recordedAt: r.recordedAt };
}

/** Static empty snapshot — used by the data source when no JSON exists yet. */
export const EMPTY_SNAPSHOT: LeadershipSnapshot = {
  generatedAt: new Date(0).toISOString(),
  source: "empty",
  observations: [],
};
