/**
 * lib/feedback/types.ts
 *
 * Boundary types + zod schemas for the customer-feedback closed-loop
 * module. Per feedback_no_silent_vendor_lock + feedback_runner_portability:
 * every caller (the /approvals capture action, the drift sweep, the
 * briefings section, the operator leadership board) speaks ONLY these
 * types. Prisma rows are translated at the store boundary (store.ts).
 *
 * The Prisma enum is UPPER_SNAKE on the wire; the UI shows the lowercase
 * labels. The maps below are the single source of truth for that mapping.
 */

import { z } from 'zod';

/** Lowercase category labels the /approvals modal surfaces, in display
 *  order. The drift sweep + briefings render these verbatim. */
export const FEEDBACK_CATEGORIES = [
  'tone',
  'structure',
  'factual',
  'length',
  'other',
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** Prisma enum values (UPPER_SNAKE), keyed by lowercase label. */
export const CATEGORY_TO_DB: Record<FeedbackCategory, string> = {
  tone: 'TONE',
  structure: 'STRUCTURE',
  factual: 'FACTUAL',
  length: 'LENGTH',
  other: 'OTHER',
};

/** Reverse map — DB enum value → lowercase label. */
export const DB_TO_CATEGORY: Record<string, FeedbackCategory> = {
  TONE: 'tone',
  STRUCTURE: 'structure',
  FACTUAL: 'factual',
  LENGTH: 'length',
  OTHER: 'other',
};

/** One-line human descriptions used in the briefings + proposal copy. */
export const CATEGORY_DESCRIPTION: Record<FeedbackCategory, string> = {
  tone: 'tone — it did not sound like you',
  structure: 'structure — the shape or order was off',
  factual: 'a factual detail was wrong',
  length: 'length — too long or too short',
  other: 'something else',
};

/** Cap on stored draft snapshots — belt-and-suspenders against a customer
 *  pasting an entire thread into the field. Mirrors the preferences
 *  module's SIGNAL_TEXT_MAX_CHARS. */
export const FEEDBACK_TEXT_MAX_CHARS = 4000;

/** Cap on the reason field. The modal hints "a sentence or two". */
export const FEEDBACK_REASON_MAX_CHARS = 2000;

/** Threshold: this many same-category corrections for one skill within a
 *  sweep window queues a CapabilityProposal AND flips the briefings copy
 *  from "noted" to "we're considering a change". Per the wave-4 spec. */
export const DRIFT_PROPOSAL_THRESHOLD = 3;

/** zod schema for the capture server action's untrusted input. */
export const submitFeedbackSchema = z.object({
  workspaceId: z.string().uuid(),
  approvalItemId: z.string().uuid(),
  targetSkillSlug: z.string().min(1).max(200),
  category: z.enum(FEEDBACK_CATEGORIES),
  reason: z.string().trim().min(1).max(FEEDBACK_REASON_MAX_CHARS),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

/** A persisted feedback row in its boundary shape. */
export interface PreferenceFeedbackView {
  id: string;
  workspaceId: string;
  userId: string | null;
  targetSkillSlug: string;
  category: FeedbackCategory;
  reason: string;
  createdAt: Date;
}

/** Per (skill, category) tally used by the drift sweep + briefings. */
export interface FeedbackCategoryTally {
  targetSkillSlug: string;
  category: FeedbackCategory;
  count: number;
}

/** What the briefings "what we learned" section needs for one workspace. */
export interface WorkspaceFeedbackWeekSummary {
  totalCorrections: number;
  /** Tally per category across all skills (for the headline counts). */
  byCategory: Array<{ category: FeedbackCategory; count: number }>;
  /** Per (skill, category) groups that met the proposal threshold —
   *  the "we're considering tightening X" lines. */
  considering: FeedbackCategoryTally[];
}

/** One workspace's correction rate, for the operator drift signal. */
export interface WorkspaceDriftRow {
  workspaceId: string;
  workspaceName: string;
  corrections: number;
  /** The category with the most corrections (ties → display order). */
  topCategory: FeedbackCategory | null;
}
