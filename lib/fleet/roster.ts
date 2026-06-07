/**
 * lib/fleet/roster.ts
 *
 * Source-of-truth registry for the INTERNAL media fleet — agentplain's own
 * go-to-market creative + platform-execution org. This is the dogfood fleet
 * that produces agentplain's ads, films, and campaigns; it is NOT a
 * customer-sellable product capability and it does NOT belong in the locked
 * customer discipline enum (`lib/disciplines/index.ts`).
 *
 * ── Architectural decision (defended in docs/fleet/media-discipline-2026-06-06.md) ──
 * Media is the production + platform-execution ARM of the existing `marketing`
 * discipline. It is NOT a 9th customer discipline. Reasons:
 *   1. The 8-discipline enum is the *customer-facing* organizing unit — it is a
 *      DB column on WorkApprovalQueueItem, a marketplace facet, and an approval
 *      grouping key (`asDisciplineId` is a locked zod enum). Adding `media`
 *      surfaces a "run our Meta ads" capability customers do not buy and that
 *      `project_no_outbound_architecture` forbids agentplain from executing.
 *   2. This fleet is agentplain's OWN GTM machine (per `feedback_agentplain_built_by_agents`).
 *      It produces agentplain's marketing, not a per-customer/per-vertical product,
 *      so it must not enter the customer disciplines enum or the per-vertical rosters.
 *   3. Every media agent therefore carries `discipline: 'marketing'` — they are the
 *      arm of Marketing that turns the message into films, statics, and live-campaign
 *      plans. Still draft-and-propose: Conner (or the customer's system) executes
 *      paid spend. No agent here ever spends ad dollars on its own.
 *
 * The internal media fleet gets its OWN home (this module + `/operator/fleet/media`)
 * so it is observable without contaminating the locked customer surface.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every surface that needs the media-fleet
 * shape (the operator panel, the docs generator, the cron owner labels) reads from
 * `listMediaFleet()` / `MEDIA_CRONS`. Slug + reporting-line strings live nowhere else.
 *
 * Per `feedback_no_guesses_no_estimates.md`: tool lists below are the picks verified in
 * `docs/marketing/campaign-2026-06-06/AI_VIDEO_STACK.md` (vendor pages, 2026-06-06) plus
 * the platform-native ad managers. No invented vendors.
 */

import { z } from 'zod';
import type { DisciplineId } from '@/lib/disciplines';

/** Org class per `project_tier1_org_model`: A = CEO-tier, B = cross-functional
 *  leadership, C = shared-services / specialist pool. The media leadership trio
 *  is Class B (cross-functional under the CEO tier); every specialist is Class C. */
export type FleetClass = 'A' | 'B' | 'C';

/** Where an agent sits inside the media discipline. */
export type MediaTier = 'leadership' | 'platform' | 'creative';

/** Stable slug — matches the `~/.claude/skills/<slug>/SKILL.md` directory and the
 *  `fromAgent`/`agentSlug` values a future handoff-log/approval row would carry. */
export type MediaAgentSlug =
  // Leadership (Class B)
  | 'media-head'
  | 'media-creative-director'
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
  // Creative production specialists (Class C)
  | 'media-video-producer'
  | 'media-static-designer'
  | 'media-copywriter-longform'
  | 'media-copywriter-direct'
  | 'media-voice-producer'
  | 'media-influencer-partnerships'
  | 'media-pr-earned'
  | 'media-analytics-attribution';

/** A `reportsTo` value that points OUTSIDE the media fleet (up the agentplain
 *  chain). The Head of Media reports into the CEO tier; Conner sits above that. */
export type ExternalManager = 'b2b-ceo';

export interface MediaAgent {
  slug: MediaAgentSlug;
  /** Display name in the operator panel + docs. */
  name: string;
  /** Job title / one-line role. */
  role: string;
  fleetClass: FleetClass;
  tier: MediaTier;
  /** Slug of the manager this agent reports to. A media-fleet slug, the external
   *  CEO-tier manager, or null only for an unmanaged root (none today). */
  reportsTo: MediaAgentSlug | ExternalManager;
  /** Locked to `marketing` — media lives inside the marketing discipline. */
  discipline: Extract<DisciplineId, 'marketing'>;
  /** What this agent produces. Drafts/proposals only — no agent here executes
   *  paid placements (`project_no_outbound_architecture`). */
  ownedOutputs: string[];
  /** Tools the agent calls. Drawn from the AI_VIDEO_STACK picks + platform-native
   *  ad managers + Bright Data MCP (research) + Plaino chat (ideation). */
  primaryTools: string[];
  /** Function ids of the standing crons this agent owns or feeds (see MEDIA_CRONS). */
  standingCrons: string[];
  /** Per `feedback_no_quick_fixes` + the leadership autonomy mandate, leadership
   *  runs on opus; specialists default to opus for craft-quality output. */
  recommendedModel: 'opus' | 'sonnet';
}

/** Standing cron the media fleet runs. The function ids match
 *  `lib/inngest/functions/media-*.ts`. Schedules are the source of truth the
 *  operator panel renders — they are NOT re-typed in the page. */
export interface MediaCron {
  /** Inngest function id. */
  functionId: string;
  /** Human label for the operator panel. */
  name: string;
  /** Standard 5-field cron expression (UTC). */
  cron: string;
  /** Plain-English cadence for the operator panel. */
  cadence: string;
  /** Slug of the agent that owns the cadence. */
  ownerSlug: MediaAgentSlug;
  /** Slugs of agents that feed the cadence. */
  contributorSlugs: MediaAgentSlug[];
  /** What the cron drafts. Draft-and-propose; nothing auto-executes. */
  drafts: string;
}

const MediaAgentSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  fleetClass: z.enum(['A', 'B', 'C']),
  tier: z.enum(['leadership', 'platform', 'creative']),
  reportsTo: z.string().min(1),
  discipline: z.literal('marketing'),
  ownedOutputs: z.array(z.string().min(1)).min(1),
  primaryTools: z.array(z.string().min(1)).min(1),
  standingCrons: z.array(z.string().min(1)),
  recommendedModel: z.enum(['opus', 'sonnet']),
});

// Function ids — single definition, imported nowhere-else-by-string. Mirrors the
// `*_FUNCTION_ID` exports the cron modules also declare; kept here so the roster +
// docs can reference the schedule without importing the Inngest modules (which pull
// the whole observability stack into the build graph of the docs/panel).
const CRON_WEEKLY_CREATIVE_REVIEW = 'media-weekly-creative-review';
const CRON_PLATFORM_PERFORMANCE_DIGEST = 'media-platform-performance-digest';
const CRON_MONTHLY_MEDIA_PLAN = 'media-monthly-media-plan';

const MEDIA_FLEET_RAW: MediaAgent[] = [
  // ── Leadership tier (Class B, cross-functional) ──
  {
    slug: 'media-head',
    name: 'Head of Media',
    role: 'Owns the media discipline; sets quarterly creative + media strategy; final approver before work reaches Conner.',
    fleetClass: 'B',
    tier: 'leadership',
    reportsTo: 'b2b-ceo',
    discipline: 'marketing',
    ownedOutputs: [
      'Quarterly creative + media strategy memo',
      'Campaign greenlight decisions (pre-Conner)',
      'Discipline budget envelope proposal (Conner approves spend)',
    ],
    primaryTools: ['Plaino chat', 'Bright Data MCP'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW, CRON_MONTHLY_MEDIA_PLAN],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-creative-director',
    name: 'Creative Director',
    role: 'Owns brand expression in every asset; reviews all creative before any media buy; defends voice + visual system.',
    fleetClass: 'B',
    tier: 'leadership',
    reportsTo: 'media-head',
    discipline: 'marketing',
    ownedOutputs: [
      'Creative review verdicts (approve / revise / reject with §-citation)',
      'Per-campaign creative brief',
      'Brand-expression guardrails for the production pool',
    ],
    primaryTools: ['Plaino chat', 'Adobe Firefly', 'Descript'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-director',
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

  // ── Platform specialists (Class C) — report to Media Director ──
  {
    slug: 'media-meta',
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

  // ── Creative production specialists (Class C) ──
  {
    slug: 'media-video-producer',
    name: 'Video producer',
    role: 'Owns video end-to-end: script → storyboard → shoot/AI-generate → edit → captions → per-channel versioning.',
    fleetClass: 'C',
    tier: 'creative',
    reportsTo: 'media-creative-director',
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
    slug: 'media-static-designer',
    name: 'Static designer',
    role: 'Display ads, social posts, OOH, print.',
    fleetClass: 'C',
    tier: 'creative',
    reportsTo: 'media-creative-director',
    discipline: 'marketing',
    ownedOutputs: [
      'Display + social static sets (per-placement sizes)',
      'OOH + print layouts',
      'Asset spec sheets for handoff',
    ],
    primaryTools: ['Adobe Firefly', 'Plaino chat'],
    standingCrons: [CRON_WEEKLY_CREATIVE_REVIEW],
    recommendedModel: 'opus',
  },
  {
    slug: 'media-copywriter-longform',
    name: 'Copywriter — long-form',
    role: 'Landing pages, articles, ebooks.',
    fleetClass: 'C',
    tier: 'creative',
    reportsTo: 'media-creative-director',
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
    slug: 'media-copywriter-direct',
    name: 'Copywriter — short-form / direct response',
    role: 'Ad copy, headlines, hooks.',
    fleetClass: 'C',
    tier: 'creative',
    reportsTo: 'media-creative-director',
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
    slug: 'media-voice-producer',
    name: 'Voice / audio producer',
    role: 'Voiceover, music selection, podcast media.',
    fleetClass: 'C',
    tier: 'creative',
    reportsTo: 'media-creative-director',
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
  {
    slug: 'media-influencer-partnerships',
    name: 'Influencer / creator partnerships',
    role: 'Sourcing, briefing, contracting (drafts; Conner signs).',
    fleetClass: 'C',
    tier: 'creative',
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
    name: 'PR / earned media',
    role: 'Pitch development, journalist relationships, podcast booking.',
    fleetClass: 'C',
    tier: 'creative',
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
    name: 'Analytics + attribution',
    role: 'Channel reporting, marketing-mix modeling, incrementality.',
    fleetClass: 'C',
    tier: 'creative',
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

const MEDIA_FLEET: readonly MediaAgent[] = (() => {
  const validated = MEDIA_FLEET_RAW.map((a) => MediaAgentSchema.parse(a) as MediaAgent);
  const slugs = new Set(validated.map((a) => a.slug));
  if (slugs.size !== validated.length) {
    throw new Error('lib/fleet/roster: duplicate slug in MEDIA_FLEET_RAW');
  }
  // Referential integrity: every `reportsTo` resolves to a media slug or the
  // external CEO-tier manager. Catches a typo'd reporting line at module load,
  // not at render time.
  const externalManagers = new Set<string>(['b2b-ceo']);
  for (const a of validated) {
    if (!slugs.has(a.reportsTo as MediaAgentSlug) && !externalManagers.has(a.reportsTo)) {
      throw new Error(
        `lib/fleet/roster: ${a.slug} reportsTo unknown manager "${a.reportsTo}"`,
      );
    }
  }
  return validated;
})();

const MEDIA_CRONS_RAW: readonly MediaCron[] = [
  {
    functionId: CRON_WEEKLY_CREATIVE_REVIEW,
    name: 'Weekly creative review',
    cron: '0 14 * * THU',
    cadence: 'Thursdays 14:00 UTC',
    ownerSlug: 'media-creative-director',
    contributorSlugs: ['media-head', 'media-video-producer', 'media-static-designer'],
    drafts:
      'A creative-review queue: every in-flight asset checked against the brand visual + voice system before any media buy.',
  },
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

/** Every media agent, in declaration order (leadership → platform → creative). */
export function listMediaFleet(): readonly MediaAgent[] {
  return MEDIA_FLEET;
}

/** Resolve a media slug to its record. Returns null on unknown slugs so callers
 *  (operator panel, docs) decide whether to skip. */
export function getMediaAgent(slug: string): MediaAgent | null {
  return MEDIA_FLEET.find((a) => a.slug === slug) ?? null;
}

/** Media agents in a given tier, declaration order preserved. */
export function listMediaByTier(tier: MediaTier): readonly MediaAgent[] {
  return MEDIA_FLEET.filter((a) => a.tier === tier);
}

/** Direct reports of a manager slug (media slug or the external CEO-tier slug). */
export function directReportsOf(managerSlug: string): readonly MediaAgent[] {
  return MEDIA_FLEET.filter((a) => a.reportsTo === managerSlug);
}

/** The three standing crons the media fleet runs. */
export function listMediaCrons(): readonly MediaCron[] {
  return MEDIA_CRONS_RAW;
}

/** Stable list of every media slug — used by tests + the docs generator. */
export const MEDIA_FLEET_IDS: readonly MediaAgentSlug[] = MEDIA_FLEET.map(
  (a) => a.slug,
);

/** The discipline every media agent belongs to. Exported so callers assert the
 *  invariant rather than hard-coding the string. */
export const MEDIA_DISCIPLINE: Extract<DisciplineId, 'marketing'> = 'marketing';
