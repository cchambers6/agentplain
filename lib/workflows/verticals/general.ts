/**
 * lib/workflows/verticals/general.ts
 *
 * The general (on-ramp / unknown-vertical) killer workflow, as a runnable story:
 *   morning inbox triage → sorted by urgency → same-day replies drafted →
 *   prioritized action list built → top items pinned.
 *
 * This is the story a brand-new workspace runs before it has picked a vertical,
 * so every owner sees Plaino do real work in the first session regardless of
 * trade.
 */

import { killerWorkflowFor } from "../../plaino/killer-workflow";
import { syntheticDatasetFor } from "../../demo/synthetic";
import type { WorkflowStory } from "../runtime";

export function generalStory(): WorkflowStory {
  const spec = killerWorkflowFor(null);
  const data = syntheticDatasetFor(null);

  return {
    vertical: null,
    headline: "Wake up to a sorted inbox and a plan for the day",
    trigger:
      "6:40am — 23 messages came in overnight. Most days you'd lose the first hour just sorting them.",
    sourceLabel: data.sourceLabel,
    connectIntegrationId: spec.connectIntegrationId,
    connectLabel: spec.connectLabel,
    connectWhy: spec.unlockWhy,
    counterVerb: "drafted",
    counterNoun: "replies",
    runsPerTrial: 7, // a morning triage each day
    steps: [
      {
        id: "read",
        label: "Read the overnight inbox",
        detail: "23 new messages caught and read before you were up.",
        action: "read",
        runMs: 1200,
      },
      {
        id: "sort",
        label: "Sorted by urgency",
        detail:
          "Split into urgent, reply-needed, and FYI — the noise pushed down, the four that matter pulled up.",
        action: "classify",
        runMs: 1500,
      },
      {
        id: "draft",
        label: "Drafted the same-day replies",
        detail:
          "Four messages needed an answer today — a reschedule, a billing question, a new inquiry, a vendor confirm. All drafted.",
        action: "draft-email",
        count: 4,
        runMs: 2000,
      },
      {
        id: "plan",
        label: "Built your action list",
        detail: "Six action items pulled from the inbox, ranked by what moves the needle.",
        action: "classify",
        runMs: 1400,
      },
      {
        id: "pin",
        label: "Pinned the top three",
        detail:
          "The three that matter most, up top in your queue — drafts attached, waiting for your approve.",
        action: "update-record",
        runMs: 1100,
      },
    ],
  };
}
