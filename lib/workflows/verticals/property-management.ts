/**
 * lib/workflows/verticals/property-management.ts
 *
 * The property-management killer workflow, as a runnable story:
 *   10pm maintenance request → triaged → vendor coordinated → tenant updated →
 *   work order logged.
 *
 * NOTE on the headline: the canonical killer-workflow registry frames PM around
 * late rent ("Rent collects itself politely"). This DEMO story runs the
 * after-hours MAINTENANCE narrative the build mandate scoped, so it carries its
 * own headline rather than the rent one — the registry is untouched and still
 * drives the activation card elsewhere. The connect target is shared.
 */

import { killerWorkflowFor } from "../../plaino/killer-workflow";
import { syntheticDatasetFor } from "../../demo/synthetic";
import type { WorkflowStory } from "../runtime";

export function propertyManagementStory(): WorkflowStory {
  const spec = killerWorkflowFor("PROPERTY_MANAGEMENT");
  const data = syntheticDatasetFor("PROPERTY_MANAGEMENT");
  const tenant = data.clients[0]!; // Carla Mendez, Unit 4B
  const vendor = data.clients[1]!; // Reliant Plumbing
  const msg = data.messages[0]!;

  return {
    vertical: "PROPERTY_MANAGEMENT",
    // Maintenance-specific headline for the demo narrative (see file note).
    headline: "Every maintenance request gets handled tonight",
    trigger: `${msg.at} — a tenant reported an after-hours maintenance emergency through the portal.`,
    sourceLabel: data.sourceLabel,
    connectIntegrationId: spec.connectIntegrationId,
    connectLabel: spec.connectLabel,
    connectWhy: spec.unlockWhy,
    counterVerb: "handled",
    counterNoun: "requests",
    runsPerTrial: 10, // after-hours requests across a portfolio in a trial
    steps: [
      {
        id: "catch",
        label: "Caught the request",
        detail: `${tenant.name} (Unit 4B): “${msg.preview}”`,
        action: "read",
        runMs: 1100,
      },
      {
        id: "triage",
        label: "Triaged it",
        detail:
          "Classified urgent — no hot water, water heater, two kids at home. This one can't wait till morning.",
        action: "classify",
        runMs: 1500,
      },
      {
        id: "coordinate",
        label: "Coordinated a vendor",
        detail: `Drafted a dispatch to ${vendor.name} with the unit, the symptom, and the access notes — ready to send to your on-call plumber.`,
        action: "coordinate",
        runMs: 1900,
      },
      {
        id: "tenant",
        label: "Updated the tenant",
        detail:
          "Drafted a calm reply letting her know help is being arranged, with the expected window.",
        action: "notify",
        runMs: 1300,
      },
      {
        id: "log",
        label: "Logged the work order",
        detail: `Work order opened on Unit 4B, both drafts waiting for your approve — you wake up to it handled, not to a 2am call.`,
        action: "update-record",
        runMs: 1200,
      },
    ],
  };
}
