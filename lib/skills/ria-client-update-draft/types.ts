/**
 * lib/skills/ria-client-update-draft/types.ts
 *
 * Provider-neutral types for the RIA quarterly client-update drafter.
 * Per IA Advisers Act § 206 + Rule 206(4)-1 (advertising rule) +
 * Rule 204A-1 (code of ethics):
 *
 *   - the draft never states an investment recommendation
 *   - the draft never claims past performance as predictive
 *   - the draft surfaces the required custody-rule + Form ADV pointers
 *   - every quantitative claim defers to an `{{advisor: ...}}` merge field
 *     so the advisor confirms before sending
 *
 * Per `feedback_no_silent_vendor_lock.md`: portfolio-management SDKs
 * (Orion / Black Diamond / Tamarac) and CRM SDKs (Redtail / Wealthbox)
 * stay behind the `PortfolioFetcher` port. The skill speaks only the
 * ports below.
 *
 * Per `project_no_outbound_architecture.md`: the skill DRAFTS. The
 * advisor's email client sends.
 */

import type { DraftPersister, SkillResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────

export interface ClientHousehold {
  /** Stable household / relationship id in the portfolio system. */
  householdId: string;
  /** Display name — used in greeting + subject. */
  displayName: string;
  /** Primary contact for the household. */
  primaryContact: ContactPerson;
  /** Co-clients copied on the update (spouse / co-trustee). */
  copyContacts: ContactPerson[];
  /** Period this update covers — e.g. "Q2 2026". */
  periodLabel: string;
  /** The advisor of record — signature merge field. */
  advisor: ContactPerson;
}

export interface ContactPerson {
  name: string;
  email: string;
}

/**
 * Compact, advisor-curated note about something that happened in the
 * household this period. The skill renders these verbatim with a
 * leading bullet — it does NOT generate market commentary. The note
 * source is the advisor's own CRM activity log, surfaced through the
 * fetcher.
 */
export interface AdvisorNote {
  /** Short label rendered as the bullet (e.g. "Annual review completed"). */
  label: string;
  /** One-sentence body — verbatim into the draft. */
  detail: string;
}

/**
 * Household-level snapshot. Only the boolean signals are used to
 * compose the update copy; the skill NEVER renders the dollar amounts
 * directly — they belong in the advisor's merge fields.
 */
export interface PortfolioSnapshot {
  /** Whether the household had any contributions this period. */
  hadContributions: boolean;
  /** Whether the household had any distributions this period. */
  hadDistributions: boolean;
  /** Whether the household rebalanced this period (model change / drift). */
  rebalanced: boolean;
  /** Whether the household had a planning meeting this period. */
  reviewedThisPeriod: boolean;
}

export interface PortfolioFetcher {
  readonly name: string;
  fetchHousehold(args: {
    workspaceId: string;
    householdId: string;
  }): Promise<SkillResult<ClientHousehold>>;
  fetchSnapshot(args: {
    workspaceId: string;
    householdId: string;
    periodLabel: string;
  }): Promise<SkillResult<PortfolioSnapshot>>;
  fetchAdvisorNotes(args: {
    workspaceId: string;
    householdId: string;
    periodLabel: string;
  }): Promise<SkillResult<AdvisorNote[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export interface ClientUpdateDraft {
  draftId: string;
  providerDraftId: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  body: string;
  tone: 'formal';
  confidence: number;
  persisted: boolean;
}

export interface RiaClientUpdateOutput {
  householdId: string;
  periodLabel: string;
  noteCount: number;
  draft: ClientUpdateDraft;
}

export interface RiaClientUpdateInput {
  workspaceId: string;
  householdId: string;
  periodLabel: string;
  fetcher: PortfolioFetcher;
  persister?: DraftPersister | null;
  persistThreshold?: number;
}

export const DEFAULT_PERSIST_THRESHOLD = 0.5;
