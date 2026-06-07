/**
 * lib/fleet/roster.ts
 *
 * Source-of-truth registry for agentplain's INTERNAL go-to-market fleet — the
 * dogfood org that produces agentplain's own marketing. It is split into TWO
 * peer disciplines (the split ratified 2026-06-06, course-correcting PR #156
 * which conflated them):
 *
 *   • CREATIVE  — production. *Makes* the work: an asset goes brief → finished
 *     file. Creative Director + the maker pool (video, static, long-form copy,
 *     direct-response copy, voice) + the creative-router (the "ask first,
 *     improvise never" tool-selection gate).
 *   • MEDIA     — distribution. *Routes* finished work to audiences: buys,
 *     earns, and measures placement. Head of Media + Media Director + the 8
 *     platform specialists + influencer partnerships + PR/earned + analytics.
 *
 * The two collaborate: Creative makes the asset; Media decides where/how/when it
 * runs. Creative briefs land from product/sales/leadership; Media briefs land
 * from Creative ("here's the asset, distribute it"). Both disciplines report to
 * the CEO tier — they are peers, not a parent/child.
 *
 * ── Why "discipline" here ≠ the customer discipline enum ──
 * Both arms still carry `discipline: 'marketing'` (the locked customer-facing
 * `DisciplineId`). Creative + Media are the production + distribution ARMS of
 * the existing `marketing` discipline — NOT new customer disciplines. Adding a
 * `media`/`creative` value to the locked 8-discipline enum would surface a
 * "run our ads" capability customers do not buy and `project_no_outbound_architecture`
 * forbids agentplain from executing. The arm split is an INTERNAL org axis
 * (`arm: 'creative' | 'media'`), orthogonal to the customer enum.
 *
 * Each arm gets its own operator home (`/operator/fleet/creative`,
 * `/operator/fleet/media`) so both are observable without contaminating the
 * locked customer surface.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every surface that needs the fleet
 * shape (the operator panels, the docs, the cron owner labels) reads from
 * `listCreativeFleet()` / `listMediaFleet()` / the cron lists. Slug +
 * reporting-line strings live nowhere else.
 *
 * Per `feedback_no_guesses_no_estimates.md`: tool lists below are the picks
 * verified in `docs/marketing/campaign-2026-06-06/AI_VIDEO_STACK.md` (vendor
 * pages, 2026-06-06), the creative-asset audit
 * (`docs/strategy/creative-asset-capability-2026-06-06/`), plus the
 * platform-native ad managers. No invented vendors.
 */

import { z } from 'zod';
import type { DisciplineId } from '@/lib/disciplines';

/** Org class per `project_tier1_org_model`: A = CEO-tier, B = cross-functional
 *  leadership, C = shared-services / specialist pool. Each discipline head +
 *  the Media Director are Class B; every specialist is Class C. */
export type FleetClass = 'A' | 'B' | 'C';

/** Which internal GTM arm an agent belongs to. Orthogonal to the locked
 *  customer discipline enum — both arms are inside `marketing`. */
export type GtmArm = 'creative' | 'media';

/** Where an agent sits inside its arm.
 *  Creative: leadership (Creative Director) · production (makers + router).
 *  Media:    leadership (Head + Director) · platform (channel specialists) ·
 *            earned (influencer / PR / analytics). */
export type FleetTier = 'leadership' | 'production' | 'platform' | 'earned';

/** Stable slug — matches the `~/.claude/skills/<slug>/SKILL.md` directory and the
 *  `fromAgent`/`agentSlug` values a future handoff-log/approval row would carry. */
export type FleetAgentSlug =
  // ── Creative discipline ──
  // Leadership (Class B)
  | 'creative-director'
  // Production specialists (Class C)
  | 'creative-router'
  | 'creative-video-producer'
  | 'creative-static-designer'
  | 'creative-copywriter-longform'
  | 'creative-copywriter-direct'
  | 'creative-voice-producer'
  // ── Media discipline ──
  // Leadership (Class B)
  | 'media-head'
  | 'media-director'
  // Platform specialists (Class C)
  | 'media-meta'
  | 'media-tiktok'
  | 'media-youtube'
  | 'media-linkedin'
  | 'media-x'
  | 'media-google-ads'
  | 'media-pinterest'
  | 'media-reddit'
  // Earned + measurement specialists (Class C)
  | 'media-influencer-partnerships'
  | 'media-pr-earned'
  | 'media-analytics-attribution';

/** A `reportsTo` value that points OUTSIDE the fleet (up the agentplain chain).
 *  Both discipline heads report into the CEO tier; Conner sits above that. */
export type ExternalManager = 'b2b-ceo';

export interface FleetAgent {
  slug: FleetAgentSlug;
  /** Internal GTM arm — the discipline this agent belongs to. */
  arm: GtmArm;
  /** Display name in the operator panel + docs. */
  name: string;
  /** Job title / one-line role. */
  role: string;
  fleetClass: FleetClass;
  tier: FleetTier;
  /** Slug of the manager this agent reports to (a fleet slug or the external
   *  CEO-tier manager). */
  reportsTo: FleetAgentSlug | ExternalManager;
  /** Locked to `marketing` — both arms live inside the marketing discipline. */
  discipline: Extract<DisciplineId, 'marketing'>;
  /** What this agent produces. Drafts/proposals only — no agent here executes
   *  paid placements (`project_no_outbound_architecture`). */
  ownedOutputs: string[];
  /** Tools the agent calls. Creative pulls from the creative-asset audit +
   *  AI_VIDEO_STACK; Media from the platform-native ad managers + Bright Data. */
  primaryTools: string[];
  /** Function ids of the standing crons this agent owns or feeds. */
  standingCrons: string[];
  /** Leadership + craft specialists default to opus for craft-quality output. */
  recommendedModel: 'opus' | 'sonnet';
}

/** Standing cron a fleet discipline runs. Function ids match
 *  `lib/inngest/functions/media-*.ts` — those ids keep their legacy `media-`
 *  prefix for Inngest registration stability even though the weekly creative
 *  review now belongs to the Creative discipline. */
export interface FleetCron {
  /** Inngest function id. */
  functionId: string;
  /** Human label for the operator panel. */
  name: string;
  /** Standard 5-field cron expression (UTC). */
  cron: string;
  /** Plain-English cadence for the operator panel. */
  cadence: string;
  /** Slug of the agent that owns the cadence. */
  ownerSlug: FleetAgentSlug;
  /** Slugs of agents that feed the cadence. */
  contributorSlugs: FleetAgentSlug[];
  /** What the cron drafts. Draft-and-propose; nothing auto-executes. */
  drafts: string;
}

const FleetAgentSchema = z.object({
  slug: z.string().min(1),
  arm: z.enum(['creative', 'media']),
  name: z.string().min(1),
  role: z.string().min(1),
  fleetClass: z.enum(['A', 'B', 'C']),
  tier: z.enum(['leadership', 'production', 'platform', 'earned']),
  reportsTo: z.string().min(1),
  discipline: z.literal('marketing'),
  ownedOutputs: z.array(z.string().min(1)).min(1),
  primaryTools: z.array(z.string().min(1)).min(1),
  standingCrons: z.array(z.string().min(1)),
  recommendedModel: z.enum(['opus', 'sonnet']),
});

// Function ids — single definition. Mirrors the `*_FUNCTION_ID` exports the cron
// modules declare; kept here so the roster + docs reference the schedule without
// importing the Inngest modules (which pull the whole observability stack into
// the build graph of the docs/panel). The `media-` prefix is a stable Inngest
// id, not a discipline label — weekly-creative-review is a Creative cadence.
const CRON_WEEKLY_CREATIVE_REVIEW = 'media-weekly-creative-review';
const CRON_PLATFORM_PERFORMANCE_DIGEST = 'media-platform-performance-digest';
const CRON_MONTHLY_MEDIA_PLAN = 'media-monthly-media-plan';

// ── Creative discipline — production. Makes the work. ──
const CREATIVE_FLEET_RAW: FleetAgent[] = [
  {
    slug: 'creative-director',
    arm: 'creative',
    name: 'Creative Director',
    role: 'Heads the Creative discipline; owns brand expression in every asset; sets production guardrails; runs the acceptance review on human-creator deliveries.',
    fleetClass: 'B',
    tier: 'leadership',
    reportsTo: 'b2b-ceo',
    discipline: 'marketing',
    ownedOutputs: [
      'Creative review verdicts (approve / revise / reject with §-citation)',
      'Per-brief creative direction',
      'Brand-expression guardrails for the production pool',
      'CreatorBrief acceptance decisions (human-creator handoff)',
    ],
    primaryTools: ['Plaino chat', 'Adobe Firefly', 'Descript'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW],
    recommendedModel: 'opus',
  },
  {
    slug: 'creative-router',
    arm: 'creative',
    name: 'Creative router',
    role: 'The "ask first, improvise never" gate. Reads the job-to-tool matrix and routes every creative-asset request to the right tool or to a human via CreatorBrief. Never renders the asset itself.',
    fleetClass: 'C',
    tier: 'production',
    reportsTo: 'creative-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Routing decisions (tool / connect / human / video-stack)',
      'CreatorBrief drafts for brand-defining work',
      'Tool-connection flags when a recurring job needs Figma/Adobe/Canva stood up',
    ],
    primaryTools: ['JOB_TO_TOOL_MATRIX', 'lib/creative-handoff', 'Plaino chat'],
    standingCrons: [],
    recommendedModel: 'opus',
  },
  {
    slug: 'creative-video-producer',
    arm: 'creative',
    name: 'Video producer',
    role: 'Owns video end-to-end: script → storyboard → shoot/AI-generate → edit → captions → per-channel versioning.',
    fleetClass: 'C',
    tier: 'production',
    reportsTo: 'creative-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Shooting script + storyboard',
      'Edited master + per-channel cutdowns (caption variants)',
      'B-roll / atmosphere plates (AI on real footage only)',
    ],
    primaryTools: ['Tella', 'Adobe Firefly (Generative Extend)', 'Runway', 'Luma Ray2', 'Descript', 'Plaino chat'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW],
    recommendedModel: 'opus',
  },
  {
    slug: 'creative-static-designer',
    arm: 'creative',
    name: 'Static designer',
    role: 'Display ads, social posts, OOH, print — designed in real tools (Figma / Adobe Express), never improvised in raw SVG.',
    fleetClass: 'C',
    tier: 'production',
    reportsTo: 'creative-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Display + social static sets (per-placement sizes)',
      'OOH + print layouts',
      'Asset spec sheets for handoff',
    ],
    primaryTools: ['Figma', 'Adobe Express', 'anthropic-skills:canvas-design', 'frontend-design', 'Adobe Firefly', 'Plaino chat'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW],
    recommendedModel: 'opus',
  },
  {
    slug: 'creative-copywriter-longform',
    arm: 'creative',
    name: 'Copywriter — long-form',
    role: 'Landing pages, articles, ebooks.',
    fleetClass: 'C',
    tier: 'production',
    reportsTo: 'creative-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Landing-page copy drafts',
      'Articles + ebooks',
      'Long-form narrative arcs (per the story-arc rule)',
    ],
    primaryTools: ['Plaino chat', 'Bright Data MCP'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW],
    recommendedModel: 'opus',
  },
  {
    slug: 'creative-copywriter-direct',
    arm: 'creative',
    name: 'Copywriter — short-form / direct response',
    role: 'Ad copy, headlines, hooks.',
    fleetClass: 'C',
    tier: 'production',
    reportsTo: 'creative-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Ad copy variant sets (per platform spec)',
      'Headline + hook banks',
      'Direct-response CTA tests',
    ],
    primaryTools: ['Plaino chat'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW],
    recommendedModel: 'opus',
  },
  {
    slug: 'creative-voice-producer',
    arm: 'creative',
    name: 'Voice / audio producer',
    role: 'Voiceover, music selection, podcast media.',
    fleetClass: 'C',
    tier: 'production',
    reportsTo: 'creative-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Voiceover drafts (one distinctive, grounded brand voice)',
      'Music + sound-design selection notes',
      'Podcast media cut + show notes',
    ],
    primaryTools: ['ElevenLabs', 'Descript', 'Plaino chat'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW],
    recommendedModel: 'opus',
  },
];

// ── Media discipline — distribution. Routes the work to audiences. ──
const MEDIA_FLEET_RAW: FleetAgent[] = [
  // Leadership (Class B)
  {
    slug: 'media-head',
    arm: 'media',
    name: 'Head of Media',
    role: 'Heads the Media discipline; sets quarterly distribution strategy; final approver before media work reaches Conner. Peer to the Creative Director.',
    fleetClass: 'B',
    tier: 'leadership',
    reportsTo: 'b2b-ceo',
    discipline: 'marketing',
    ownedOutputs: [
      'Quarterly media / distribution strategy memo',
      'Campaign greenlight decisions (pre-Conner)',
      'Discipline budget envelope proposal (Conner approves spend)',
    ],
    primaryTools: ['Plaino chat', 'Bright Data MCP'],
    standingCrons: [CRON_MONTHLY_MEDIA_PLAN],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-director',
    arm: 'media',
    name: 'Media Director',
    role: 'Owns paid + earned media planning, budget allocation across channels, and attribution models.',
    fleetClass: 'B',
    tier: 'leadership',
    reportsTo: 'media-head',
    discipline: 'marketing',
    ownedOutputs: [
      'Monthly media plan (channel mix + proposed budget split)',
      'Cross-channel attribution model',
      'Weekly platform-performance digest',
    ],
    primaryTools: ['Plaino chat', 'Bright Data MCP'],
    standingCrons: [CRON_MONTHLY_MEDIA_PLAN, CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'opus',
  },

  // Platform specialists (Class C) — report to the Media Director
  {
    slug: 'media-meta',
    arm: 'media',
    name: 'Meta media specialist',
    role: 'Facebook + Instagram + Threads — ads manager, pixel + Conversions API, custom audiences, creative testing, Reels.',
    fleetClass: 'C',
    tier: 'platform',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Meta campaign plan (audiences, placements, creative test matrix)',
      'Reels organic strategy draft',
      'Conversions API / pixel event-mapping proposal',
    ],
    primaryTools: ['Meta Ads Manager (plan-only)', 'Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-tiktok',
    arm: 'media',
    name: 'TikTok specialist',
    role: 'TikTok Ads + Spark Ads, creator marketplace, algorithm-fit organic.',
    fleetClass: 'C',
    tier: 'platform',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'TikTok campaign + Spark Ads plan',
      'Creator-marketplace shortlist + brief draft',
      'Algorithm-fit organic hook list',
    ],
    primaryTools: ['TikTok Ads Manager (plan-only)', 'Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-youtube',
    arm: 'media',
    name: 'YouTube specialist',
    role: 'Pre-roll + bumper + Shorts + sponsored content; YouTube as a B2B and B2C channel.',
    fleetClass: 'C',
    tier: 'platform',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'YouTube campaign plan (pre-roll / bumper / Shorts mix)',
      'Sponsored-placement shortlist + brief',
      'Channel + Shorts organic cadence draft',
    ],
    primaryTools: ['Google Ads (YouTube, plan-only)', 'Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-linkedin',
    arm: 'media',
    name: 'LinkedIn specialist',
    role: 'Sponsored content, lead-gen forms, ABM targeting, organic thought leadership.',
    fleetClass: 'C',
    tier: 'platform',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'LinkedIn campaign plan (sponsored content + lead-gen forms)',
      'ABM target-account list + sequencing draft',
      'Organic thought-leadership cadence',
    ],
    primaryTools: ['LinkedIn Campaign Manager (plan-only)', 'Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-x',
    arm: 'media',
    name: 'X / Twitter specialist',
    role: 'X Ads + community + organic.',
    fleetClass: 'C',
    tier: 'platform',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'X campaign plan (ads + amplification)',
      'Community-engagement playbook draft',
      'Organic post cadence',
    ],
    primaryTools: ['X Ads (plan-only)', 'Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-google-ads',
    arm: 'media',
    name: 'Google Ads specialist',
    role: 'Search + Display + Performance Max + YouTube Shopping.',
    fleetClass: 'C',
    tier: 'platform',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Search + Display + PMax campaign plan',
      'Keyword + negative-keyword set draft',
      'Responsive search ad asset matrix',
    ],
    primaryTools: ['Google Ads (plan-only)', 'Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-pinterest',
    arm: 'media',
    name: 'Pinterest specialist',
    role: 'Commerce-focused channels (vertical-dependent) — Pin + idea-pin strategy, shopping.',
    fleetClass: 'C',
    tier: 'platform',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Pinterest campaign plan (where the vertical fits commerce)',
      'Pin + idea-pin creative direction',
      'Shopping-feed mapping draft',
    ],
    primaryTools: ['Pinterest Ads (plan-only)', 'Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'sonnet',
  },
  {
    slug: 'media-reddit',
    arm: 'media',
    name: 'Reddit specialist',
    role: 'Community + ads + AMA programming.',
    fleetClass: 'C',
    tier: 'platform',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Reddit campaign plan (subreddit fit + ad units)',
      'AMA programming + moderation-respecting brief',
      'Community-participation guidelines draft',
    ],
    primaryTools: ['Reddit Ads (plan-only)', 'Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'sonnet',
  },

  // Earned + measurement specialists (Class C) — report to the Media Director
  {
    slug: 'media-influencer-partnerships',
    arm: 'media',
    name: 'Influencer / creator partnerships',
    role: 'Sourcing, briefing, contracting (drafts; Conner signs).',
    fleetClass: 'C',
    tier: 'earned',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Creator shortlist + fit rationale',
      'Partnership brief drafts',
      'Contract term-sheet drafts (counsel + Conner approve)',
    ],
    primaryTools: ['Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-pr-earned',
    arm: 'media',
    name: 'PR / earned media',
    role: 'Pitch development, journalist relationships, podcast booking.',
    fleetClass: 'C',
    tier: 'earned',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Pitch drafts + media-list research',
      'Journalist / outlet relationship notes',
      'Podcast booking outreach drafts (Conner sends)',
    ],
    primaryTools: ['Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_MONTHLY_MEDIA_PLAN],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-analytics-attribution',
    arm: 'media',
    name: 'Analytics + attribution',
    role: 'Channel reporting, marketing-mix modeling, incrementality. Sits in Media because it measures distribution; when a read needs a visualization, it routes that asset through the creative-router like any other creative request.',
    fleetClass: 'C',
    tier: 'earned',
    reportsTo: 'media-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Weekly platform-performance digest',
      'Marketing-mix / incrementality read',
      'Attribution-model maintenance notes',
    ],
    primaryTools: ['Bright Data MCP', 'Plaino chat'],
    standingCrons: [CRON_PLATFORM_PERFORMANCE_DIGEST, CRON_MONTHLY_MEDIA_PLAN],
    recommendedModel: 'opus',
  },
];

// Validate + integrity-check the union of both arms at module load.
const FLEET: readonly FleetAgent[] = (() => {
  const all = [...CREATIVE_FLEET_RAW, ...MEDIA_FLEET_RAW].map(
    (a) => FleetAgentSchema.parse(a) as FleetAgent,
  );
  const slugs = new Set(all.map((a) => a.slug));
  if (slugs.size !== all.length) {
    throw new Error('lib/fleet/roster: duplicate slug across the fleet');
  }
  // Referential integrity: every `reportsTo` resolves to a fleet slug or the
  // external CEO-tier manager. Catches a typo'd reporting line at module load.
  const externalManagers = new Set<string>(['b2b-ceo']);
  for (const a of all) {
    if (!slugs.has(a.reportsTo as FleetAgentSlug) && !externalManagers.has(a.reportsTo)) {
      throw new Error(
        `lib/fleet/roster: ${a.slug} reportsTo unknown manager "${a.reportsTo}"`,
      );
    }
  }
  return all;
})();

const CREATIVE_FLEET: readonly FleetAgent[] = FLEET.filter((a) => a.arm === 'creative');
const MEDIA_FLEET: readonly FleetAgent[] = FLEET.filter((a) => a.arm === 'media');

// Weekly creative review is a CREATIVE cadence (it reviews creative). The two
// distribution crons are MEDIA. Function ids keep the legacy `media-` prefix.
const CREATIVE_CRONS_RAW: readonly FleetCron[] = [
  {
    functionId: CRON_WEEKLY_CREATIVE_REVIEW,
    name: 'Weekly creative review',
    cron: '0 14 * * THU',
    cadence: 'Thursdays 14:00 UTC',
    ownerSlug: 'creative-director',
    contributorSlugs: ['creative-video-producer', 'creative-static-designer'],
    drafts:
      'A creative-review queue: every in-flight asset checked against the brand visual + voice system before it is handed to Media for distribution.',
  },
];

const MEDIA_CRONS_RAW: readonly FleetCron[] = [
  {
    functionId: CRON_PLATFORM_PERFORMANCE_DIGEST,
    name: 'Platform performance digest',
    cron: '0 15 * * MON',
    cadence: 'Mondays 15:00 UTC',
    ownerSlug: 'media-director',
    contributorSlugs: [
      'media-analytics-attribution',
      'media-meta',
      'media-tiktok',
      'media-youtube',
      'media-linkedin',
      'media-x',
      'media-google-ads',
    ],
    drafts:
      'A cross-channel performance read with per-platform deltas and a proposed next-week reallocation (Conner approves any spend move).',
  },
  {
    functionId: CRON_MONTHLY_MEDIA_PLAN,
    name: 'Monthly media plan',
    cron: '0 13 1 * *',
    cadence: '1st of each month, 13:00 UTC',
    ownerSlug: 'media-director',
    contributorSlugs: ['media-head', 'media-pr-earned', 'media-analytics-attribution'],
    drafts:
      'A draft media plan for the month: channel mix, proposed budget split, and the earned-media calendar. A proposal, not a spend.',
  },
];

// ── Public API ──

/** Every Creative-discipline agent, in declaration order (leadership → production). */
export function listCreativeFleet(): readonly FleetAgent[] {
  return CREATIVE_FLEET;
}

/** Every Media-discipline agent, in declaration order (leadership → platform → earned). */
export function listMediaFleet(): readonly FleetAgent[] {
  return MEDIA_FLEET;
}

/** Resolve any fleet slug (either arm) to its record, or null. */
export function getFleetAgent(slug: string): FleetAgent | null {
  return FLEET.find((a) => a.slug === slug) ?? null;
}

/** Back-compat alias — resolves across the whole fleet (not Media-only). Kept
 *  so existing callers keep working after the arm split. */
export const getMediaAgent = getFleetAgent;

/** Creative agents in a given tier, declaration order preserved. */
export function listCreativeByTier(tier: FleetTier): readonly FleetAgent[] {
  return CREATIVE_FLEET.filter((a) => a.tier === tier);
}

/** Media agents in a given tier, declaration order preserved. */
export function listMediaByTier(tier: FleetTier): readonly FleetAgent[] {
  return MEDIA_FLEET.filter((a) => a.tier === tier);
}

/** Direct reports of a manager slug (any fleet slug or the external CEO-tier slug). */
export function directReportsOf(managerSlug: string): readonly FleetAgent[] {
  return FLEET.filter((a) => a.reportsTo === managerSlug);
}

/** The Creative discipline's standing cron(s). */
export function listCreativeCrons(): readonly FleetCron[] {
  return CREATIVE_CRONS_RAW;
}

/** The Media discipline's standing crons. */
export function listMediaCrons(): readonly FleetCron[] {
  return MEDIA_CRONS_RAW;
}

/** Every standing cron across both disciplines. */
export function listAllCrons(): readonly FleetCron[] {
  return [...CREATIVE_CRONS_RAW, ...MEDIA_CRONS_RAW];
}

/** Stable list of every Creative slug — used by tests + docs. */
export const CREATIVE_FLEET_IDS: readonly FleetAgentSlug[] = CREATIVE_FLEET.map((a) => a.slug);

/** Stable list of every Media slug — used by tests + docs. */
export const MEDIA_FLEET_IDS: readonly FleetAgentSlug[] = MEDIA_FLEET.map((a) => a.slug);

/** The locked customer discipline both arms belong to. Exported so callers
 *  assert the invariant rather than hard-coding the string. */
export const MARKETING_DISCIPLINE: Extract<DisciplineId, 'marketing'> = 'marketing';
