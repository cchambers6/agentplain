/**
 * lib/skills/month-end-close-cpa/pm-fetcher-shared.ts
 *
 * Shared, vendor-neutral helpers for the practice-management `CloseFetcher`
 * implementations (QuickBooks / TaxDome / Karbon). Pulling these out of
 * `quickbooks-fetcher.ts` keeps the three production adapters honest about
 * what each contract derives WITHOUT three copies of the templated
 * checklist drifting apart.
 *
 * Nothing here imports a vendor SDK — these are pure functions over the
 * skill's own types. Per `feedback_no_silent_vendor_lock.md` the vendor
 * calls live only in each adapter file + `lib/integrations/*-mcp/`.
 */

import { skillError, type SkillResult } from '../types';
import type {
  ChecklistCategory,
  ChecklistItem,
  EngagementScope,
} from './types';

const MS_PER_DAY = 86_400_000;

/**
 * Internal-deadline derivation: the firm-side close target. The 15th of
 * the month AFTER the period close — the standard CPA cadence for monthly
 * closes. The firm can override per engagement when a per-workspace config
 * UI lands.
 *
 * `2026-04` → `2026-05-15` (UTC midnight).
 */
export function deriveInternalDeadline(periodMonth: string): Date {
  const [yr, mo] = periodMonth.split('-').map((s) => Number.parseInt(s, 10));
  if (!Number.isFinite(yr) || !Number.isFinite(mo)) return new Date();
  return new Date(Date.UTC(yr, mo, 15));
}

/**
 * Per-scope templated checklist. Mirrors the standard CPA engagement-letter
 * pattern: bookkeeping-only is two items; full-stack is the long set.
 * `dueAt` is set 5 days BEFORE the internal deadline so chase emails give
 * the client a runway to respond.
 *
 * HONEST: this is a TEMPLATE, not a field any vendor stored. It matches the
 * firm's engagement-letter pattern. The Karbon adapter is the one that
 * derives a REAL checklist from in-flight jobs; QuickBooks + TaxDome use
 * this template because their contracts carry no structured checklist.
 */
export function checklistForScope(
  scope: EngagementScope,
  periodMonth: string,
  internalDeadline: Date,
): ChecklistItem[] {
  const due = new Date(internalDeadline.getTime() - 5 * MS_PER_DAY);
  const items: Array<{
    label: string;
    category: ChecklistCategory;
    required: boolean;
  }> = [];
  items.push({
    label: `Bank statement(s) for ${periodMonth}`,
    category: 'bank-statement',
    required: true,
  });
  items.push({
    label: `Business credit-card statement(s) for ${periodMonth}`,
    category: 'credit-card-statement',
    required: true,
  });
  if (scope === 'bookkeeping-plus-payroll' || scope === 'full-stack-monthly') {
    items.push({
      label: `Payroll register for ${periodMonth}`,
      category: 'payroll-register',
      required: true,
    });
  }
  if (scope === 'full-stack-monthly') {
    items.push({
      label: `Loan / line-of-credit statements for ${periodMonth}`,
      category: 'loan-statement',
      required: false,
    });
    items.push({
      label: `Sales-tax filing confirmation for ${periodMonth}`,
      category: 'sales-tax-filing',
      required: true,
    });
    items.push({
      label: `AR / AP aging snapshot at month-end`,
      category: 'ar-ap-detail',
      required: true,
    });
    items.push({
      label: `Fixed-asset additions / disposals during ${periodMonth}`,
      category: 'fixed-asset-changes',
      required: false,
    });
    items.push({
      label: `Owner distributions / contributions during ${periodMonth}`,
      category: 'owner-distributions',
      required: false,
    });
  }
  return items.map((it, idx) => ({
    id: `${periodMonth}-${idx + 1}-${it.category}`,
    label: it.label,
    category: it.category,
    dueAt: due,
    required: it.required,
  }));
}

/**
 * Keyword sets per checklist category for best-effort filename → category
 * matching of practice-management uploads. Deliberately conservative: only
 * confident, low-collision keywords. An upload we cannot confidently bucket
 * returns null so the skill surfaces it as an uncategorized receipt rather
 * than falsely marking a checklist item received.
 */
const CATEGORY_KEYWORDS: Partial<Record<ChecklistCategory, string[]>> = {
  'bank-statement': ['bank', 'checking', 'savings'],
  'credit-card-statement': ['credit', 'creditcard', 'cc-statement', 'amex', 'visa', 'mastercard'],
  'loan-statement': ['loan', 'line-of-credit', 'loc', 'mortgage', 'note'],
  'payroll-register': ['payroll', 'wage', 'gusto', 'adp', 'paychex'],
  'sales-tax-filing': ['sales-tax', 'salestax', 'sales_tax', 'st-filing'],
  'ar-ap-detail': ['aging', 'ar-ap', 'ar_ap', 'receivable', 'payable'],
  'fixed-asset-changes': ['fixed-asset', 'fixedasset', 'depreciation', 'asset'],
  'owner-distributions': ['distribution', 'draw', 'owner-equity', 'contribution'],
  'inventory-count': ['inventory', 'stock-count', 'count-sheet'],
};

/**
 * Best-effort match of an uploaded filename to a checklist item id. Returns
 * the id of the FIRST checklist item whose category keywords appear in the
 * (lower-cased) filename, or null when no confident match exists.
 *
 * Honest by design: a null return is the correct answer for an ambiguous
 * upload — the skill renders it as an uncategorized receipt for the
 * operator to triage. We never guess a checklist item satisfied.
 */
export function matchReceivedToChecklist(
  filename: string,
  checklist: ChecklistItem[],
): string | null {
  const lower = filename.toLowerCase();
  for (const item of checklist) {
    const keywords = CATEGORY_KEYWORDS[item.category];
    if (!keywords) continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      return item.id;
    }
  }
  return null;
}

/**
 * Translate an MCP error code from a CPA practice-management server into a
 * skill error. Credential-shaped failures map to NOT_CONFIGURED (so the
 * operator surface shows a calm "connect <provider>" prompt); everything
 * else surfaces as an upstream error with the provider-prefixed message.
 *
 * NOT_FOUND maps to NOT_APPLICABLE — the client id is valid input but the
 * provider has no such client (honest: "that client is not on file here").
 */
export function translateCpaMcpError(
  code: string,
  message: string,
  opts: { provider: string; notConnectedMessage: string },
): SkillResult<never> {
  if (
    code === 'CREDENTIAL_NOT_FOUND' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'GRANT_REVOKED' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN'
  ) {
    return skillError('NOT_CONFIGURED', opts.notConnectedMessage, code);
  }
  if (code === 'NOT_FOUND') {
    return skillError(
      'NOT_APPLICABLE',
      `${opts.provider}: ${message}`,
      code,
    );
  }
  return skillError('UPSTREAM_GMAIL_ERROR', `${opts.provider}: ${message}`, code);
}
