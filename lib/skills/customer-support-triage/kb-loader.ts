/**
 * lib/skills/customer-support-triage/kb-loader.ts
 *
 * The knowledge base for L1 auto-answers. Per the mandate: NOT a vector
 * DB — keyword/LLM-judged retrieval over CURATED in-repo sources is fine
 * and cold-start safe. The KB is the marketing FAQ content (the same
 * source of truth /pricing + the homepage render + the FAQPage JSON-LD
 * derive from) plus a small set of product/brand facts. One source of
 * truth, no copy-paste drift.
 *
 * Cold-start safe (feedback_cold_start_safe_agents.md): load() reads the
 * static FAQ_ITEMS array on every call — there is no embedding index to
 * warm, no cache that can go stale. A redeploy with new FAQ copy is live
 * the next fire.
 *
 * Two-implementation rule (feedback_runner_portability.md): the
 * production loader below + the RecordingKbLoader in the test file.
 */

import { FAQ_ITEMS } from '../../../components/faq-items';
import type { IKbLoader, KbEntry } from './types';

/**
 * Curated product/brand facts that aren't in the customer-facing FAQ but
 * are common L1 support questions. Kept SMALL and load-bearing — each one
 * is a fact an owner asks support, with a calm, accurate answer. Anything
 * compliance/legal/billing-dispute-shaped is deliberately ABSENT (those
 * escalate before they reach the KB).
 */
export const PRODUCT_KB: readonly KbEntry[] = [
  {
    title: 'How do I connect or disconnect a tool?',
    body:
      "Your integrations live on the /integrations page in your workspace. " +
      "Each available tool (email, calendar, documents, accounting, " +
      "e-signature) has a connect tile; disconnecting is the same tile. The " +
      "fleet only reads through the connections you've authorized, and only " +
      "what a given task needs.",
    source: 'product-kb',
  },
  {
    title: 'How do I pause the fleet (vacation / cutover)?',
    body:
      "You can pause all fleet activity from your workspace settings — set a " +
      "pause window and nothing drafts or fires until it lifts. You can also " +
      "narrow a pause to specific disciplines. Resuming is the same control.",
    source: 'product-kb',
  },
  {
    title: 'Where do I review what the fleet drafted?',
    body:
      "Everything the fleet produces lands in your approvals queue for review " +
      "before anything leaves your firm. The fleet drafts; you decide. " +
      "Nothing is sent, no money moves, and no commitment is made without your " +
      "approval.",
    source: 'product-kb',
  },
  {
    title: "I'm not receiving my sign-in link / magic link",
    body:
      "Sign-in links are single-use and time-limited. If yours expired or " +
      "didn't arrive, request a fresh one from the sign-in page — it sends a " +
      "new link to your workspace email. Check spam if it doesn't land in a " +
      "minute. If your email tool moved it, your service partner can also " +
      "re-trigger one for you.",
    source: 'product-kb',
  },
  {
    title: 'How do I change my plan or seats?',
    body:
      "Plan and seat changes happen in your billing settings — month-to-month, " +
      "no long-term contract, cancel anytime. If you're weighing Regular vs. " +
      "Partner, the difference is review cadence and how dedicated your service " +
      "partner is; your partner can walk you through which fits.",
    source: 'product-kb',
  },
];

/**
 * Production KB loader. Combines the customer-facing FAQ (source of truth)
 * with the small product-KB above. Pure read; no I/O beyond the static
 * imports, so it's safe to call on every fire.
 */
export class RepoKbLoader implements IKbLoader {
  readonly name = 'repo-kb';

  load(): KbEntry[] {
    const fromFaq: KbEntry[] = FAQ_ITEMS.map((item) => ({
      title: item.q,
      body: item.a,
      source: item.topic === 'pricing' ? 'faq-pricing' : 'faq',
    }));
    return [...fromFaq, ...PRODUCT_KB];
  }
}
