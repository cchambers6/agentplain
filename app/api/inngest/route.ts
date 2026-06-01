// Inngest serve route. Registers every cron / event-driven function with
// Inngest Cloud at the GET handshake, and delivers per-function invocations
// at POST.
//
// Per PROJECT_STATE PR-B notes: this slim route is the seam future
// functions (Gmail webhook fanout, briefing schedulers, etc.) wire into.
// Adding a function = importing it and appending to the `functions` array.
//
// Per feedback_no_silent_vendor_lock: Inngest itself is the live fleet
// runner per `reference_inngest_is_the_live_fleet`. The disable-flag
// pattern (lib/inngest/disable-flag.ts) is the in-house portability
// surface above Inngest — pausing a function flips its env var rather
// than relying on Inngest Cloud's UI.

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { trialExpirationWarningsFn } from "@/lib/inngest/functions/trial-expiration-warnings";
import { integrationRenewalSweepFn } from "@/lib/inngest/functions/integration-renewal-sweep";
import { processWebhookEventFn } from "@/lib/inngest/functions/process-webhook-event";
import { customerFilesIngestionSweepFn } from "@/lib/inngest/functions/customer-files-ingestion-sweep";
import { schedulerSweepFn } from "@/lib/inngest/functions/scheduler-sweep";
import { followUpChaserSweepFn } from "@/lib/inngest/functions/follow-up-chaser-sweep";
import { processDocDrafterSweepFn } from "@/lib/inngest/functions/process-doc-drafter-sweep";
import { supportHandlerOnCreateFn } from "@/lib/inngest/functions/support-handler-on-create";
import { instructionHandlerOnCreateFn } from "@/lib/inngest/functions/instruction-handler-on-create";
import { stripeUsageMeterSweepFn } from "@/lib/inngest/functions/stripe-usage-meter-sweep";
import { briefingsGeneratorSweepFn } from "@/lib/inngest/functions/briefings-generator-sweep";
import { workspaceTeardownSweepFn } from "@/lib/customer-data";
// Wave-3 discipline-wrap closers — analytics / marketing / legal crons.
// Research-on-demand rides the existing instruction-handler path (no
// new cron); the dispatcher routes research-tagged turns into it.
import { analyticsPulseSweepFn } from "@/lib/inngest/functions/analytics-weekly-pulse-sweep";
import { contentCalendarSweepFn } from "@/lib/inngest/functions/content-calendar-drafter-sweep";
import { complianceWatchSweepFn } from "@/lib/inngest/functions/compliance-watch-sweep";
// Wave-3 realty CRM sync — hourly Follow Up Boss → lead-triage → CRM
// write-back of triage decision.
import { followUpBossSyncSweepFn } from "@/lib/inngest/functions/follow-up-boss-sync-sweep";
// Wave-4 discipline-wrap closer — flips finance from PARTIAL →
// DELIVERING by giving every workspace a weekly finance pulse.
import { financePulseSweepFn } from "@/lib/inngest/functions/finance-pulse-sweep";
// Wave-4 — closes PR #123's honesty gap: workspaces that abandoned
// Stripe Checkout now move through a nudge → deactivate → archive
// lifecycle instead of running forever on the free side.
import { stripeAbandonedSignupSweepFn } from "@/lib/inngest/functions/stripe-abandoned-signup-sweep";
// Wave-7 — universal MCPs. Notion ingests pages into the substrate.
// HubSpot + Salesforce sync inbound leads into lead-triage and write
// triage decisions back as notes/tasks.
import { notionIngestSweepFn } from "@/lib/inngest/functions/notion-ingest-sweep";
import { hubspotSyncSweepFn } from "@/lib/inngest/functions/hubspot-sync-sweep";
import { salesforceSyncSweepFn } from "@/lib/inngest/functions/salesforce-sync-sweep";
// Wave-8 — b2b-* agents moved from flatsbo so their token usage bills
// to agentplain (where the work belongs). Stubs for now; CronDefinition
// runner port is the follow-up. See lib/inngest/functions/b2b-*.ts.
import { b2bCeoDailyFn } from "@/lib/inngest/functions/b2b-ceo-daily";
import { b2bSalesRepPreCallBriefFn } from "@/lib/inngest/functions/b2b-sales-rep-pre-call-brief";
import { b2bSalesRepReplySweepFn } from "@/lib/inngest/functions/b2b-sales-rep-reply-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    trialExpirationWarningsFn,
    integrationRenewalSweepFn,
    processWebhookEventFn,
    customerFilesIngestionSweepFn,
    schedulerSweepFn,
    followUpChaserSweepFn,
    processDocDrafterSweepFn,
    supportHandlerOnCreateFn,
    instructionHandlerOnCreateFn,
    stripeUsageMeterSweepFn,
    briefingsGeneratorSweepFn,
    workspaceTeardownSweepFn,
    analyticsPulseSweepFn,
    contentCalendarSweepFn,
    complianceWatchSweepFn,
    followUpBossSyncSweepFn,
    financePulseSweepFn,
    stripeAbandonedSignupSweepFn,
    notionIngestSweepFn,
    hubspotSyncSweepFn,
    salesforceSyncSweepFn,
    b2bCeoDailyFn,
    b2bSalesRepPreCallBriefFn,
    b2bSalesRepReplySweepFn,
  ],
});
