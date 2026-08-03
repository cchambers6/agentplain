/**
 * lib/provenance/describe.ts
 *
 * The ONLY sanctioned translation from a provenance block to words a
 * customer reads.
 *
 * Per feedback_customer_vocab_not_engineer: the enum values in
 * `types.ts` are engineer labels. A customer must never see
 * 'agent-inference', 'skill-run', 'crm-import' — or the word
 * "provenance" itself. They see "Plaino worked this out on its own" and
 * "came in from your connected CRM", because that is what actually
 * happened, said the way they'd say it.
 *
 * Per feedback_model_vendor_invisible_on_customer_surfaces: no model or
 * vendor name appears in any string here. Plaino is the named service
 * partner (project_plaino_named_agent) and is the only actor we name.
 *
 * Per the honesty rule: an unconfirmed inference SAYS it is unconfirmed.
 * We would rather show a customer a hedge than let a guess sit on the
 * page looking like something they told us.
 */

import type { Provenance } from './types';

/**
 * One short clause describing where a stored fact came from, in the
 * customer's own vocabulary. Written lowercase-first so it drops into
 * the memory page's font-mono eyebrow row alongside "updated Jun 12"
 * without a case clash (the row applies `uppercase` in CSS).
 */
export function describeProvenance(p: Provenance): string {
  switch (p.sourceType) {
    case 'customer-chat':
      return 'you told Plaino this in chat';
    case 'customer-edit':
      return 'you wrote this yourself';
    case 'operator-entry':
      return 'someone on your team entered this';
    case 'webhook':
      return 'came in from a tool you connected';
    case 'crm-import':
      return 'came in from your connected CRM';
    case 'csv-upload':
      return 'came from a file you uploaded';
    case 'agent-inference':
      // The schema pins `verified: false` for inferences at write time,
      // so today only the hedged string ships. The confirmed branch is
      // here because a later human confirmation SHOULD change what the
      // customer reads — the copy must not have to be rewritten to make
      // that honest.
      return p.verified
        ? 'Plaino worked this out on its own — you confirmed it'
        : 'Plaino worked this out on its own — unconfirmed';
    case 'skill-run':
      return 'Plaino put this together while working';
    case 'system':
      return 'set up automatically';
  }
}

/**
 * Recover the ChatMessage id a block points at, so the citation can link
 * back to the exact turn. Returns null for every other kind of
 * `sourceRef` (a webhook event, a skill run, a marketing route) — those
 * have no chat turn to open, and inventing a link to one would be a lie
 * the customer could click.
 */
export function sourceChatMessageIdFromRef(p: Provenance): string | null {
  const prefix = 'ChatMessage:';
  if (!p.sourceRef.startsWith(prefix)) return null;
  const id = p.sourceRef.slice(prefix.length).trim();
  return id.length > 0 ? id : null;
}
