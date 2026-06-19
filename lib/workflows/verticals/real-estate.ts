/**
 * lib/workflows/verticals/real-estate.ts
 *
 * The real-estate killer workflow, as a runnable story:
 *   9pm lead → enriched → personalized response drafted → tour proposed →
 *   CRM updated.
 *
 * The one thing every agent loses deals over: a lead that lands after hours
 * and sits untouched till morning. Plaino catches it the moment it arrives,
 * does the homework, and has the first touch waiting for the owner's approval.
 *
 * Built from the real-estate synthetic dataset; headline + connect target come
 * from the canonical killer-workflow registry so the demo never drifts from the
 * activation promise.
 */

import { killerWorkflowFor } from "../../plaino/killer-workflow";
import { syntheticDatasetFor } from "../../demo/synthetic";
import type { WorkflowStory } from "../runtime";

export function realEstateStory(): WorkflowStory {
  const spec = killerWorkflowFor("REAL_ESTATE");
  const data = syntheticDatasetFor("REAL_ESTATE");
  const lead = data.clients[0]!; // Marcus Pope
  const msg = data.messages[0]!;

  return {
    vertical: "REAL_ESTATE",
    headline: spec.headline, // "Every lead gets a first touch in 5 minutes"
    trigger: `${msg.at} — a new buyer lead landed from your website while you were off the clock.`,
    sourceLabel: data.sourceLabel,
    connectIntegrationId: spec.connectIntegrationId,
    connectLabel: spec.connectLabel,
    connectWhy: spec.unlockWhy,
    counterVerb: "drafted",
    counterNoun: "first touches",
    runsPerTrial: 14, // ~2 after-hours leads a day across the trial
    steps: [
      {
        id: "catch",
        label: "Caught the lead",
        detail: `${lead.name} asked about 418 Peachtree Way at ${msg.at} — “${msg.preview}”`,
        action: "read",
        runMs: 1100,
      },
      {
        id: "enrich",
        label: "Enriched the lead",
        detail: `Pulled context: ${lead.context}.`,
        action: "enrich",
        runMs: 1600,
      },
      {
        id: "draft",
        label: "Drafted a personalized first touch",
        detail:
          "A warm reply that answers his question, confirms the home is available, and offers two showing windows.",
        action: "draft-email",
        runMs: 1800,
      },
      {
        id: "schedule",
        label: "Proposed two showing times",
        detail:
          "Saturday 10:30am and Sunday 2:00pm — both pulled from your open calendar.",
        action: "schedule",
        runMs: 1400,
      },
      {
        id: "log",
        label: "Logged it in your CRM",
        detail: `${lead.name} tagged hot, next step set, the whole thread filed — waiting for your approve.`,
        action: "update-record",
        runMs: 1200,
      },
    ],
  };
}
