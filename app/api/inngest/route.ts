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
// Wave-9 — self-serve onboarding wizard. The wizard's "set your voice"
// step dispatches agentplain/onboarding.first-fire.requested; this
// function fans out to each picked skill's run-for-workspace so the
// customer sees the first SkillRun row land in the watch panel within
// minutes of finishing onboarding.
import { onboardingFirstFireFn } from "@/lib/inngest/functions/onboarding-first-fire";
// Wave-10 phase-1 — one-off backfill that rewinds in-flight wave-8
// customers from set_preferences/first_fire_watch back to pick_skills so
// they pass through the wave-9 picker. Dispatched once via the operator
// script or the agentplain/onboarding.backfill-pick-skills.requested
// event. Idempotent.
import { onboardingBackfillPickSkillsFn } from "@/lib/inngest/functions/onboarding-backfill-pick-skills";
// Wave-10 phase-3a — seed-inbox seam. Google + Outlook OAuth callbacks
// dispatch agentplain/mcp.connected.seed-inbox the moment a workspace's
// first inbox credential lands. The wave-10 handler is a no-op that
// records an audit row; wave-10b will swap in real substrate ingestion
// of the last 7 days of inbox content.
import { mcpConnectedSeedInboxFn } from "@/lib/inngest/functions/mcp-connected-seed-inbox";
// Wave-4 customer-feedback closed loop — weekly drift sweep aggregates
// categorized /approvals corrections and queues a CapabilityProposal per
// skill+category that crosses the threshold. The /briefings "what we
// learned" section + the operator leadership board read the same substrate.
import { customerFeedbackDriftSweepFn } from "@/lib/inngest/functions/customer-feedback-drift-sweep";
// Media discipline — internal GTM media fleet standing work (see
// lib/fleet/roster.ts + docs/fleet/media-discipline-2026-06-06.md). Honest
// stubs awaiting the same CronDefinition runner port as the b2b-* crons;
// they register cleanly and cost zero Anthropic tokens until the runner lands.
import { mediaWeeklyCreativeReviewFn } from "@/lib/inngest/functions/media-weekly-creative-review";
import { mediaPlatformPerformanceDigestFn } from "@/lib/inngest/functions/media-platform-performance-digest";
import { mediaMonthlyMediaPlanFn } from "@/lib/inngest/functions/media-monthly-media-plan";
// Wave-8 (audit theme #18) — competitive-signal feed. Real, scheduled feed
// that replaces the dormant quarterly watch-memo charters: pulls competitive
// movements for the verticals we run a head for and drafts a digest the
// vertical heads consume. Provider behind lib/competitive-signals (fixture
// default; flag-gated live Bright Data MCP). Draft-and-propose, no outbound.
import { competitiveSignalFeedSweepFn } from "@/lib/inngest/functions/competitive-signal-feed-sweep";
// cv-general — QuickBooks AR invoice-chase autopilot. Daily 6 AM UTC sweep
// reads overdue invoices, drafts tier-escalating chase messages keyed on
// days-overdue, and stages each as a FOLLOW_UP_NUDGE approval item. When the
// BOUNDED_AUTO_EXECUTE_MASTER is on, these auto-approve so the owner wakes up
// to chased invoices. Payload carries balanceUsd for value-ledger ROI.
import { invoiceChaseGeneralSweepFn } from "@/lib/inngest/functions/invoice-chase-general-sweep";
// cv/home-services-estimates — daily estimate follow-up cron for
// HOME_SERVICES workspaces with a connected QuickBooks account.
import { homeServicesEstimateFollowupSweepFn } from "@/lib/inngest/functions/home-services-estimate-followup-sweep";
// Wave cv-x2 — weekly proof-of-value digest. Every Monday morning each
// active workspace gets a "what Plaino did for you last week" digest
// (hours saved, dollars influenced incl. real AR where a payload carried
// it, actions staged vs auto-executed, per-skill breakdown) persisted as a
// WorkspaceBriefing row so the web + mobile briefings views render it. The
// renewal-proof surface. Deterministic render, no LLM in the hot path.
import { weeklyProofDigestSweepFn } from "@/lib/inngest/functions/weekly-proof-digest-sweep";
// pfd-4 — leak-path auto-refund. Daily sweep finds paying workspaces in an
// UNSUPPORTED vertical (registry truth) with zero value delivered and either
// auto-refunds (when UNSUPPORTED_VERTICAL_AUTO_REFUND=on) or — by default —
// pages a human in detect-only mode. Nobody pays for a vertical we can't serve.
import { unsupportedVerticalRefundSweepFn } from "@/lib/inngest/functions/unsupported-vertical-refund-sweep";

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
    onboardingFirstFireFn,
    onboardingBackfillPickSkillsFn,
    mcpConnectedSeedInboxFn,
    customerFeedbackDriftSweepFn,
    mediaWeeklyCreativeReviewFn,
    mediaPlatformPerformanceDigestFn,
    mediaMonthlyMediaPlanFn,
    competitiveSignalFeedSweepFn,
    invoiceChaseGeneralSweepFn,
    homeServicesEstimateFollowupSweepFn,
    weeklyProofDigestSweepFn,
    unsupportedVerticalRefundSweepFn,
  ],
});
