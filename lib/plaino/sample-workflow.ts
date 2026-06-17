/**
 * lib/plaino/sample-workflow.ts
 *
 * "Try with sample data" — the synthetic dataset behind the killer-workflow
 * DEMO. A brand-new workspace in degraded/empty mode currently sees a void:
 * nothing has come in, no tool is connected, so there is nothing to show.
 * This module lets the owner TRY their vertical's killer workflow on
 * obviously-synthetic data BEFORE connecting a single tool — they see the
 * shape of the payoff first, then connect to make it real.
 *
 * Pairs with `killer-workflow.ts`: the demo's headline is the SAME locked
 * activation promise (`killerWorkflowFor(vertical).headline`), and the demo
 * page's "make it real" CTA deep-links to that workflow's
 * `connectIntegrationId`. The demo is the see-it-first half of the
 * connect-to-unlock loop.
 *
 * PURE + deterministic. No I/O, no LLM (the key is paused — the demo is the
 * one surface that proves value WITHOUT it), no DB, no migration. Every row
 * is hand-authored and clearly labeled sample data on the surface that
 * renders it — it is never mistaken for the customer's real numbers.
 *
 * Brand voice: Plaino's calm heritage register, lowercase casual, no
 * exclamation points, "local businesses" not "SMB". Names + figures are
 * plainly fictional.
 */

import type { Vertical } from '@prisma/client';
import { killerWorkflowFor } from './killer-workflow';

/** One row of the demo: what Plaino saw in the sample data, and what it
 *  drafted for it. Mirrors the trigger → draft shape of the real loop. */
export interface SampleWorkflowRow {
  /** The sample trigger Plaino picked up. */
  trigger: string;
  /** What Plaino drafted in response — the deliverable the owner approves. */
  drafted: string;
  /** Short status chip ("triaged hot", "needs your eyes"). */
  detail: string;
}

export interface SampleWorkflow {
  /** The killer-workflow headline — identical to the activation promise so
   *  the demo and the connect CTA tell one story. */
  headline: string;
  /** One-line framing of the sample scenario. */
  scenario: string;
  /** Where the sample data is pretending to come from — names the tool the
   *  real workflow rides on ("from a sample Follow Up Boss pipeline"). */
  sourceLabel: string;
  /** The marketplace tile id the "make it real" CTA deep-links to (the
   *  killer workflow's `connectIntegrationId`). */
  connectIntegrationId: string;
  /** Human label for that integration ("Follow Up Boss"). */
  connectLabel: string;
  /** The synthetic rows. Always 3 — enough to show the pattern. */
  rows: readonly SampleWorkflowRow[];
}

/** Per-vertical synthetic rows. Keyed by `Vertical`; anything unmapped uses
 *  the general (invoice-chase) set, matching the killer-workflow fallback. */
const SAMPLE_ROWS: Partial<Record<Vertical, Omit<SampleWorkflow, 'headline' | 'connectIntegrationId' | 'connectLabel'>>> = {
  REAL_ESTATE: {
    scenario:
      "Three new leads landed overnight. Here's what Plaino had drafted before you finished coffee.",
    sourceLabel: 'from a sample Follow Up Boss pipeline',
    rows: [
      {
        trigger:
          'New buyer lead — Dana Whitfield, asking about 142 Peachtree St ($435k)',
        drafted:
          'First-touch reply offering two showing windows this week.',
        detail: 'triaged hot · drafted in 3 min',
      },
      {
        trigger:
          'Seller inquiry — Marcus Bell, weighing a listing on a 3BR in Decatur',
        drafted:
          'Reply offering a comparative-market-analysis and a callback time.',
        detail: 'triaged warm',
      },
      {
        trigger:
          'Cold lead re-engaged — Priya Anand, went quiet 40 days ago',
        drafted:
          'Light re-touch referencing her saved search in Brookhaven.',
        detail: 'triaged nurture',
      },
    ],
  },
  CPA: {
    scenario:
      "It's the 3rd. Here's where Plaino had your close before you opened the file.",
    sourceLabel: 'from a sample TaxDome client list',
    rows: [
      {
        trigger: 'Patel Holdings — 1099s and bank statements still missing',
        drafted:
          'Reminder requesting the two open documents, with the deadline.',
        detail: '3 of 5 docs in',
      },
      {
        trigger: 'Greenline LLC — all documents uploaded, ready for review',
        drafted: 'Close checklist assembled and flagged for your review.',
        detail: 'ready',
      },
      {
        trigger: "Okafor & Sons — payroll figures don't reconcile",
        drafted: 'Note asking the client to confirm the March payroll run.',
        detail: 'needs your eyes',
      },
    ],
  },
  LAW: {
    scenario:
      'A few new intakes came in. Here are the conflict screens Plaino ran against your matters.',
    sourceLabel: 'from a sample matter list',
    rows: [
      {
        trigger: 'New intake — Sandra Reyes v. Cobb Logistics (employment)',
        drafted:
          'Conflict screen clear against open matters; intake summary drafted.',
        detail: 'no conflict · cleared',
      },
      {
        trigger:
          'New intake — Cobb Logistics, an unrelated commercial-lease dispute',
        drafted:
          'Conflict flagged — you represent the opposing party in Reyes. Held for your call.',
        detail: 'conflict — do not take',
      },
      {
        trigger: 'New intake — Daniel Okoro, estate planning',
        drafted: 'Conflict screen clear; intake summary drafted for review.',
        detail: 'no conflict',
      },
    ],
  },
  PROPERTY_MANAGEMENT: {
    scenario:
      "It's the 6th. Here are the late units Plaino had reminders ready for.",
    sourceLabel: 'from a sample Buildium rent roll',
    rows: [
      {
        trigger: 'Unit 4B — Jordan Mills, rent 5 days late ($1,650)',
        drafted:
          'Courteous reminder with the balance and the online-pay link.',
        detail: 'first reminder',
      },
      {
        trigger:
          'Unit 12A — Elena Cruz, partial payment in ($800 of $1,400)',
        drafted: 'Polite note confirming receipt and the remaining balance.',
        detail: 'partial',
      },
      {
        trigger: 'Unit 7C — Sam Reilly, late three months running',
        drafted: 'Firmer reminder, flagged for your call before it escalates.',
        detail: 'needs your eyes',
      },
    ],
  },
};

/** The general (invoice-chase) sample set — fallback for any vertical
 *  without a bespoke demo, matching the general killer workflow. */
const GENERAL_SAMPLE: Omit<SampleWorkflow, 'headline' | 'connectIntegrationId' | 'connectLabel'> = {
  scenario:
    "Here's what Plaino chased overnight on a sample set of overdue invoices.",
  sourceLabel: 'from a sample QuickBooks ledger',
  rows: [
    {
      trigger: 'Invoice #1042 — Northgate Cafe, 18 days overdue ($2,400)',
      drafted: 'Friendly payment reminder with the invoice and a pay link.',
      detail: 'first chase',
    },
    {
      trigger: 'Invoice #1037 — Bellweather Co, 45 days overdue ($6,100)',
      drafted: 'Firmer follow-up referencing the prior reminder.',
      detail: 'second chase',
    },
    {
      trigger: 'Invoice #1051 — Cedar & Co, 5 days overdue ($900)',
      drafted: 'Gentle nudge ahead of the due-date lapse.',
      detail: 'early nudge',
    },
  ],
};

/**
 * Resolve the sample workflow for a vertical. The headline + connect target
 * come from the canonical killer-workflow registry so the demo never drifts
 * from the activation promise; the rows are the vertical's synthetic set
 * (general fallback when none is defined).
 */
export function sampleWorkflowFor(
  vertical: Vertical | null | undefined,
): SampleWorkflow {
  const spec = killerWorkflowFor(vertical);
  const base = (vertical && SAMPLE_ROWS[vertical]) || GENERAL_SAMPLE;
  return {
    headline: spec.headline,
    scenario: base.scenario,
    sourceLabel: base.sourceLabel,
    connectIntegrationId: spec.connectIntegrationId,
    connectLabel: spec.connectLabel,
    rows: base.rows,
  };
}
