/**
 * Tests for the operator leadership board.
 *
 * Coverage split:
 *
 *   1. Pure classifier logic — `classifyAgent`, `classifyBoard`. The
 *      Stuck-counter is the load-bearing piece for tomorrow's 06:00 ET
 *      cron flip; the test pins its grace-window semantics so future
 *      refactors can't silently slip the bar.
 *
 *   2. Snapshot parsing — `parseSnapshot` tolerates the messy shapes a
 *      half-written file or older script can produce.
 *
 *   3. Source adapter — `LeadershipDataSnapshotSource` returns
 *      EMPTY_SNAPSHOT on ENOENT / malformed JSON, never throws into the
 *      page.
 *
 *   4. View render — renderToStaticMarkup over `LeadershipBoardView` for
 *      three fixtures (empty / populated / all-stuck). Asserts on the
 *      string output rather than the JSX tree; the tests stay framework-
 *      level rather than DOM-level.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  EMPTY_SNAPSHOT,
  LEADERSHIP_ROSTER,
  STUCK_GRACE_MS,
  TIER_ORDER,
  classifyAgent,
  classifyBoard,
  parseSnapshot,
  type AgentObservation,
  type LeadershipSnapshot,
} from "@/lib/operator/leadership-data";
import { LeadershipDataSnapshotSource } from "@/lib/operator/leadership-data-snapshot";
import LeadershipBoardView from "@/app/(operator)/operator/leadership-board/LeadershipBoardView";

const REFERENCE_NOW = new Date("2026-05-13T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function rosterById(id: string) {
  const a = LEADERSHIP_ROSTER.find((r) => r.id === id);
  if (!a) throw new Error(`roster entry not found: ${id}`);
  return a;
}

// ---------------------------------------------------------------------------
// classifyAgent
// ---------------------------------------------------------------------------

describe("classifyAgent — status derivation", () => {
  const dailyAgent = rosterById("flatsbo-ceo");

  it("returns NotYetFired when there is no observation", () => {
    assert.equal(classifyAgent(dailyAgent, null, REFERENCE_NOW), "NotYetFired");
  });

  it("returns NotYetFired when observation has no lastFiredAt", () => {
    const obs: AgentObservation = {
      agentId: dailyAgent.id,
      lastFiredAt: null,
      lastFireSummary: null,
      lastError: null,
      latestRecommendation: null,
      latestEscalation: null,
    };
    assert.equal(classifyAgent(dailyAgent, obs, REFERENCE_NOW), "NotYetFired");
  });

  it("returns Errored when lastError is set even with a recent fire", () => {
    const obs: AgentObservation = {
      agentId: dailyAgent.id,
      lastFiredAt: new Date(REFERENCE_NOW.getTime() - 60 * 1000).toISOString(),
      lastFireSummary: "fired",
      lastError: "anthropic 503",
      latestRecommendation: null,
      latestEscalation: null,
    };
    assert.equal(classifyAgent(dailyAgent, obs, REFERENCE_NOW), "Errored");
  });

  it("returns Healthy for a daily agent that fired 12h ago", () => {
    const obs: AgentObservation = {
      agentId: dailyAgent.id,
      lastFiredAt: new Date(REFERENCE_NOW.getTime() - 12 * HOUR_MS).toISOString(),
      lastFireSummary: "ok",
      lastError: null,
      latestRecommendation: null,
      latestEscalation: null,
    };
    assert.equal(classifyAgent(dailyAgent, obs, REFERENCE_NOW), "Healthy");
  });

  it("returns Healthy at exactly cadence + 30min grace", () => {
    const cadencePlusGrace = dailyAgent.cronCadenceMs + STUCK_GRACE_MS;
    const obs: AgentObservation = {
      agentId: dailyAgent.id,
      lastFiredAt: new Date(REFERENCE_NOW.getTime() - cadencePlusGrace).toISOString(),
      lastFireSummary: "ok",
      lastError: null,
      latestRecommendation: null,
      latestEscalation: null,
    };
    assert.equal(classifyAgent(dailyAgent, obs, REFERENCE_NOW), "Healthy");
  });

  it("flips to Stuck once past cadence + 30min grace by one second", () => {
    const cadencePlusGracePlusOne =
      dailyAgent.cronCadenceMs + STUCK_GRACE_MS + 1000;
    const obs: AgentObservation = {
      agentId: dailyAgent.id,
      lastFiredAt: new Date(
        REFERENCE_NOW.getTime() - cadencePlusGracePlusOne,
      ).toISOString(),
      lastFireSummary: "ok",
      lastError: null,
      latestRecommendation: null,
      latestEscalation: null,
    };
    assert.equal(classifyAgent(dailyAgent, obs, REFERENCE_NOW), "Stuck");
  });

  it("respects per-agent cadence — every-3h agent flips Stuck after 3h30m", () => {
    const threeHourAgent = rosterById("capability-builder");
    assert.equal(threeHourAgent.cronCadenceMs, 3 * HOUR_MS);
    const justUnder: AgentObservation = {
      agentId: threeHourAgent.id,
      lastFiredAt: new Date(
        REFERENCE_NOW.getTime() - (3 * HOUR_MS + STUCK_GRACE_MS),
      ).toISOString(),
      lastFireSummary: "ok",
      lastError: null,
      latestRecommendation: null,
      latestEscalation: null,
    };
    assert.equal(classifyAgent(threeHourAgent, justUnder, REFERENCE_NOW), "Healthy");
    const justOver: AgentObservation = {
      agentId: threeHourAgent.id,
      lastFiredAt: new Date(
        REFERENCE_NOW.getTime() - (3 * HOUR_MS + STUCK_GRACE_MS + 1000),
      ).toISOString(),
      lastFireSummary: "ok",
      lastError: null,
      latestRecommendation: null,
      latestEscalation: null,
    };
    assert.equal(classifyAgent(threeHourAgent, justOver, REFERENCE_NOW), "Stuck");
  });

  it("treats a malformed lastFiredAt timestamp as NotYetFired (never extrapolated)", () => {
    const obs: AgentObservation = {
      agentId: dailyAgent.id,
      lastFiredAt: "not-a-date",
      lastFireSummary: null,
      lastError: null,
      latestRecommendation: null,
      latestEscalation: null,
    };
    assert.equal(classifyAgent(dailyAgent, obs, REFERENCE_NOW), "NotYetFired");
  });
});

// ---------------------------------------------------------------------------
// classifyBoard — Stuck counter is the load-bearing assertion
// ---------------------------------------------------------------------------

describe("classifyBoard — counters", () => {
  it("counts all roster agents as NotYetFired on an empty snapshot", () => {
    const board = classifyBoard(EMPTY_SNAPSHOT, REFERENCE_NOW);
    assert.equal(board.summary.totalAgents, LEADERSHIP_ROSTER.length);
    assert.equal(board.summary.firedInLast24h, 0);
    assert.equal(board.summary.stuck, 0);
    assert.equal(board.summary.healthy, 0);
    assert.equal(board.summary.pendingConnerAction, 0);
  });

  it("counts only agents past cadence + 30min grace as Stuck", () => {
    // Three daily agents — one fresh, one inside grace, one over.
    const fresh = new Date(REFERENCE_NOW.getTime() - HOUR_MS).toISOString();
    const insideGrace = new Date(
      REFERENCE_NOW.getTime() - (DAY_MS + STUCK_GRACE_MS - 60 * 1000),
    ).toISOString();
    const overGrace = new Date(
      REFERENCE_NOW.getTime() - (DAY_MS + STUCK_GRACE_MS + 60 * 1000),
    ).toISOString();
    const snapshot: LeadershipSnapshot = {
      generatedAt: REFERENCE_NOW.toISOString(),
      source: "manual",
      observations: [
        baseObservation("flatsbo-ceo", { lastFiredAt: fresh }),
        baseObservation("b2b-ceo", { lastFiredAt: insideGrace }),
        baseObservation("chief-of-staff", { lastFiredAt: overGrace }),
      ],
    };
    const board = classifyBoard(snapshot, REFERENCE_NOW);
    assert.equal(board.summary.stuck, 1, "only the over-grace agent counts as Stuck");
    assert.equal(board.summary.healthy, 2);
    assert.equal(board.summary.firedInLast24h, 1, "fresh fire only");
  });

  it("counts PROPOSED recommendations as pendingConnerAction", () => {
    const snapshot: LeadershipSnapshot = {
      generatedAt: REFERENCE_NOW.toISOString(),
      source: "manual",
      observations: [
        baseObservation("flatsbo-ceo", {
          lastFiredAt: new Date(REFERENCE_NOW.getTime() - HOUR_MS).toISOString(),
          latestRecommendation: {
            id: "rec-1",
            status: "PROPOSED",
            title: "Move pricing CTA above the fold",
            recordedAt: REFERENCE_NOW.toISOString(),
          },
        }),
        baseObservation("b2b-ceo", {
          lastFiredAt: new Date(REFERENCE_NOW.getTime() - HOUR_MS).toISOString(),
          latestRecommendation: {
            id: "rec-2",
            status: "ADOPTED",
            title: "Old one already shipped",
            recordedAt: REFERENCE_NOW.toISOString(),
          },
        }),
      ],
    };
    const board = classifyBoard(snapshot, REFERENCE_NOW);
    assert.equal(board.summary.pendingConnerAction, 1);
  });

  it("orders tiers A → B → C → 1 → 1.5", () => {
    const board = classifyBoard(EMPTY_SNAPSHOT, REFERENCE_NOW);
    assert.deepEqual(
      board.tiers.map((t) => t.tier),
      TIER_ORDER,
    );
  });
});

// ---------------------------------------------------------------------------
// parseSnapshot — defensive parsing
// ---------------------------------------------------------------------------

describe("parseSnapshot", () => {
  it("throws on a non-object payload", () => {
    assert.throws(() => parseSnapshot(null));
    assert.throws(() => parseSnapshot("hello"));
  });

  it("throws on a missing or non-ISO generatedAt", () => {
    assert.throws(() => parseSnapshot({ observations: [] }));
    assert.throws(() => parseSnapshot({ generatedAt: "not-iso", observations: [] }));
  });

  it("normalizes an unknown source to 'manual'", () => {
    const out = parseSnapshot({
      generatedAt: REFERENCE_NOW.toISOString(),
      source: "garbage",
      observations: [],
    });
    assert.equal(out.source, "manual");
  });

  it("drops observations without an agentId rather than rejecting the snapshot", () => {
    const out = parseSnapshot({
      generatedAt: REFERENCE_NOW.toISOString(),
      source: "manual",
      observations: [
        { lastFiredAt: REFERENCE_NOW.toISOString() }, // missing agentId
        { agentId: "flatsbo-ceo", lastFiredAt: REFERENCE_NOW.toISOString() },
      ],
    });
    assert.equal(out.observations.length, 1);
    assert.equal(out.observations[0].agentId, "flatsbo-ceo");
  });

  it("tolerates a missing observations array", () => {
    const out = parseSnapshot({
      generatedAt: REFERENCE_NOW.toISOString(),
      source: "manual",
    });
    assert.deepEqual(out.observations, []);
  });
});

// ---------------------------------------------------------------------------
// LeadershipDataSnapshotSource — adapter behavior
// ---------------------------------------------------------------------------

describe("LeadershipDataSnapshotSource", () => {
  it("returns EMPTY_SNAPSHOT when the file is absent (ENOENT)", async () => {
    const src = new LeadershipDataSnapshotSource({
      snapshotPath: "/nonexistent/leadership-snapshot.json",
      readFileImpl: async () => {
        const err = new Error("not found") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      },
    });
    const snap = await src.load();
    assert.equal(snap.source, "empty");
    assert.deepEqual(snap.observations, []);
  });

  it("returns EMPTY_SNAPSHOT when the file contains malformed JSON", async () => {
    const src = new LeadershipDataSnapshotSource({
      readFileImpl: async () => "{ not valid json",
    });
    const snap = await src.load();
    assert.equal(snap.source, "empty");
  });

  it("returns the parsed snapshot on a happy-path read", async () => {
    const payload: LeadershipSnapshot = {
      generatedAt: REFERENCE_NOW.toISOString(),
      source: "flatsbo-repo",
      observations: [
        baseObservation("flatsbo-ceo", {
          lastFiredAt: REFERENCE_NOW.toISOString(),
          lastFireSummary: "Daily memo drafted.",
        }),
      ],
    };
    const src = new LeadershipDataSnapshotSource({
      readFileImpl: async () => JSON.stringify(payload),
    });
    const snap = await src.load();
    assert.equal(snap.source, "flatsbo-repo");
    assert.equal(snap.observations.length, 1);
    assert.equal(snap.observations[0].lastFireSummary, "Daily memo drafted.");
  });
});

// ---------------------------------------------------------------------------
// LeadershipBoardView — render smoke tests
// ---------------------------------------------------------------------------

function renderBoard(snapshot: LeadershipSnapshot): string {
  const board = classifyBoard(snapshot, REFERENCE_NOW);
  return renderToStaticMarkup(
    createElement(LeadershipBoardView, {
      board,
      now: REFERENCE_NOW,
    }),
  );
}

describe("LeadershipBoardView — render", () => {
  it("renders the empty-state for an empty snapshot", () => {
    const html = renderBoard(EMPTY_SNAPSHOT);
    assert.match(html, /Leadership board/);
    assert.match(html, /Leadership tier hasn/); // empty-state copy
    // Empty-state counter row should still show 0 / 21.
    assert.match(html, new RegExp(`0 / ${LEADERSHIP_ROSTER.length}`));
  });

  it("has no no-op Refresh control, and states how the snapshot updates", () => {
    // The route is force-dynamic (re-reads the snapshot every render), so a
    // Refresh button would be a no-op. It was removed in favor of an honest
    // line telling the operator the snapshot is regenerated out-of-band.
    const html = renderBoard(EMPTY_SNAPSHOT);
    assert.doesNotMatch(html, />\s*Refresh\s*</);
    assert.match(html, /Regenerated out-of-band/);
    assert.match(html, /Reload to\s+re-read the latest/);
  });

  it("renders a populated snapshot with at least one agent summary line", () => {
    const snapshot: LeadershipSnapshot = {
      generatedAt: REFERENCE_NOW.toISOString(),
      source: "flatsbo-repo",
      observations: [
        baseObservation("flatsbo-ceo", {
          lastFiredAt: new Date(REFERENCE_NOW.getTime() - HOUR_MS).toISOString(),
          lastFireSummary: "Daily memo drafted — focus on PR-A reviews.",
          latestRecommendation: {
            id: "rec-1",
            status: "PROPOSED",
            title: "Pin the pricing tier above the fold",
            recordedAt: REFERENCE_NOW.toISOString(),
          },
        }),
      ],
    };
    const html = renderBoard(snapshot);
    assert.match(html, /Daily memo drafted/);
    assert.match(html, /flatsbo-ceo/);
    // Pending counter reflects the PROPOSED recommendation.
    assert.match(html, /Pending Conner action[\s\S]*>1</);
  });

  it("renders an all-stuck snapshot — every roster entry past cadence + grace", () => {
    const stuckTimestamp = new Date(
      REFERENCE_NOW.getTime() - (DAY_MS + STUCK_GRACE_MS + 60 * 1000),
    ).toISOString();
    const snapshot: LeadershipSnapshot = {
      generatedAt: REFERENCE_NOW.toISOString(),
      source: "manual",
      observations: LEADERSHIP_ROSTER.map((a) =>
        baseObservation(a.id, { lastFiredAt: stuckTimestamp }),
      ),
    };
    const board = classifyBoard(snapshot, REFERENCE_NOW);
    // capability-builder fires every 3h, so a 24h-old timestamp is *also*
    // past its cadence. Every agent in this fixture should land Stuck.
    assert.equal(board.summary.stuck, LEADERSHIP_ROSTER.length);
    const html = renderBoard(snapshot);
    // Stuck counter is rendered with that exact number.
    assert.match(
      html,
      new RegExp(`Stuck[\\s\\S]*>${LEADERSHIP_ROSTER.length}<`),
    );
  });
});

// ---------------------------------------------------------------------------
// fixture helper
// ---------------------------------------------------------------------------

function baseObservation(
  agentId: string,
  overrides: Partial<AgentObservation> = {},
): AgentObservation {
  return {
    agentId,
    lastFiredAt: null,
    lastFireSummary: null,
    lastError: null,
    latestRecommendation: null,
    latestEscalation: null,
    ...overrides,
  };
}
