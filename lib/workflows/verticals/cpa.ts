/**
 * lib/workflows/verticals/cpa.ts
 *
 * The CPA killer workflow, as a runnable story:
 *   scan the client list → flag who's missing documents → draft 47 personalized
 *   "where's your 1099" requests → parse the replies → update each close.
 *
 * The batch step is the standout: 47 personalized requests is a half-day of a
 * person's time. The saved-minutes math credits it honestly — 47 items at the
 * calibrated `request-doc` rate (3 min each) — never a hand-waved "hours saved".
 */

import { killerWorkflowFor } from "../../plaino/killer-workflow";
import { syntheticDatasetFor } from "../../demo/synthetic";
import type { WorkflowStory } from "../runtime";

export function cpaStory(): WorkflowStory {
  const spec = killerWorkflowFor("CPA");
  const data = syntheticDatasetFor("CPA");
  const urgent = data.clients[0]!; // Cobb & Lane LLC

  return {
    vertical: "CPA",
    headline: spec.headline, // "Month-end close assembles itself"
    trigger:
      "It's the 1st — quarter-end close starts this week, and the usual scramble for missing client documents is about to begin.",
    sourceLabel: data.sourceLabel,
    connectIntegrationId: spec.connectIntegrationId,
    connectLabel: spec.connectLabel,
    connectWhy: spec.unlockWhy,
    counterVerb: "drafted",
    counterNoun: "document requests",
    runsPerTrial: 2, // a close cycle hits roughly twice in a trial window
    steps: [
      {
        id: "scan",
        label: "Scanned your client list",
        detail: "52 clients checked against their quarter-end document checklist.",
        action: "read",
        runMs: 1300,
      },
      {
        id: "flag",
        label: "Flagged who's still missing documents",
        detail: `47 clients are short at least one item — ${urgent.name} alone is missing two 1099s and a bank statement.`,
        action: "classify",
        runMs: 1500,
      },
      {
        id: "request",
        label: "Drafted 47 personalized document requests",
        detail:
          "Each one names the exact missing items and the deadline — not a form letter. Four minutes of Plaino's time, a half-day of yours.",
        action: "request-doc",
        count: 47,
        runMs: 2400,
      },
      {
        id: "parse",
        label: "Parsed the replies that came back",
        detail:
          "12 clients responded with attachments — Plaino matched each document to the right file and checklist line.",
        action: "classify",
        runMs: 1600,
      },
      {
        id: "update",
        label: "Updated each close",
        detail:
          "Every checklist advanced, the still-waiting clients flagged for a nudge — all queued for your review.",
        action: "update-record",
        runMs: 1300,
      },
    ],
  };
}
