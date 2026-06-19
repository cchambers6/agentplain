/**
 * lib/workflows/verticals/law.ts
 *
 * The law killer workflow, as a runnable story:
 *   11pm inbound intake → qualified + conflict-screened → consult invite drafted
 *   → fee agreement drafted → all held for the owner's approval in the morning.
 *
 * Two promises in one run: never miss a late-night intake to a faster firm, and
 * never take a conflicted client. The conflict screen is the locked
 * killer-workflow headline; the full intake is what the demo shows running.
 */

import { killerWorkflowFor } from "../../plaino/killer-workflow";
import { syntheticDatasetFor } from "../../demo/synthetic";
import type { WorkflowStory } from "../runtime";

export function lawStory(): WorkflowStory {
  const spec = killerWorkflowFor("LAW");
  const data = syntheticDatasetFor("LAW");
  const intake = data.clients[0]!; // Priya Raman
  const msg = data.messages[0]!;

  return {
    vertical: "LAW",
    headline: spec.headline, // "Never take a conflicted client"
    trigger: `${msg.at} — a new client intake came in through your site, long after the office closed.`,
    sourceLabel: data.sourceLabel,
    connectIntegrationId: spec.connectIntegrationId,
    connectLabel: spec.connectLabel,
    connectWhy: spec.unlockWhy,
    counterVerb: "drafted",
    counterNoun: "intake packets",
    runsPerTrial: 7, // ~1 after-hours intake a day
    steps: [
      {
        id: "catch",
        label: "Caught the intake",
        detail: `${intake.name}: “${msg.preview}”`,
        action: "read",
        runMs: 1100,
      },
      {
        id: "screen",
        label: "Qualified it and screened for conflicts",
        detail:
          "Matter summarized, then screened against your full matter list — no conflicts found. (A separate inquiry from an opposing party tonight WAS flagged and held.)",
        action: "classify",
        runMs: 1900,
      },
      {
        id: "invite",
        label: "Drafted a consult invite",
        detail: "A Tuesday 9:00am consult, drafted from your open calendar.",
        action: "schedule",
        runMs: 1400,
      },
      {
        id: "agreement",
        label: "Drafted the engagement & fee agreement",
        detail:
          "Scoped to a contract review, your standard terms filled in — ready for your signature, not sent.",
        action: "draft-document",
        runMs: 2100,
      },
      {
        id: "hold",
        label: "Held it all for your morning approval",
        detail: `${intake.name}'s packet — invite, agreement, intake summary — waiting at the top of your queue. Nothing left the building.`,
        action: "update-record",
        runMs: 1200,
      },
    ],
  };
}
