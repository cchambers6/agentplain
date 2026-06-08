/**
 * lib/skills/month-end-close-cpa/gmail-close-fetcher.ts
 *
 * Third implementation of `CloseFetcher` (wave-5, pride theme #12 / ratif #7).
 *
 * The audit named a "GmailCloseFetcher": before this, `fetchReceivedDocs`
 * had no real source, so the CPA month-end close returned empty even when
 * the client had EMAILED the documents — the doc-chase the skill exists to
 * remove kept firing for files that were already in. This fetcher auto-
 * DETECTS received month-end docs from the client's email attachments via
 * the workspace-scoped Gmail MCP server, then categorizes each attachment
 * against the engagement checklist.
 *
 * Composition over inheritance: engagement + checklist still come from a
 * BASE fetcher (JsonCloseFetcher today, the QuickBooks MCP later). This
 * fetcher delegates those two calls and OVERRIDES `fetchReceivedDocs` to
 * merge Gmail-detected attachments with whatever the base reports — so a
 * workspace can mix portal uploads (base) with emailed docs (Gmail).
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file speaks the
 * `GmailMcpServer` PORT, never `googleapis`. The Gmail SDK stays inside
 * `lib/integrations/gmail-mcp/server.ts`.
 *
 * Per `feedback_runner_portability.md`: tests bind the deterministic
 * `TestGmailMcpServer` (fixture attachments) — no live creds. Production
 * binds `buildGmailMcpServer({ workspaceId })`.
 *
 * Per `feedback_cold_start_safe_agents.md`: every call re-queries Gmail;
 * nothing is cached across fires.
 *
 * Per `project_no_outbound_architecture.md`: this is a READ — list +
 * get messages. It never sends.
 */

import type { GmailMcpServer, MessageAttachment } from '../../integrations/gmail-mcp';
import { skillOk, type SkillResult } from '../types';
import type {
  ChecklistItem,
  ClientEngagement,
  CloseFetcher,
  ReceivedDoc,
} from './types';

export interface GmailCloseFetcherArgs {
  /** Base fetcher that owns engagement + checklist (and may report its own
   *  portal-sourced received docs, which we merge with Gmail-detected ones). */
  base: CloseFetcher;
  /** Workspace-scoped Gmail MCP server. */
  gmail: GmailMcpServer;
  /**
   * Gmail search query that scopes which messages we scan for attachments.
   * Production passes a client-domain-scoped query (e.g.
   * `has:attachment from:@acme-llc.com newer_than:60d`). Defaults to a
   * broad attachment scan; the caller SHOULD narrow it per engagement.
   */
  query?: string;
  /** Cap on messages scanned per close. Default 25. */
  maxMessages?: number;
  /** Attachment mime/extension allowlist — defaults to the document types a
   *  month-end close cares about (PDF, spreadsheets, CSV, images of
   *  statements). Anything else (logos, signatures, calendar invites) is
   *  ignored so we don't flood the close with noise. */
  allowedExtensions?: string[];
}

// Default scan window. We deliberately do NOT use `has:attachment` here:
// the attachment-extension allowlist below is the real filter, and the
// test MCP server treats unknown bare tokens as a subject/body match
// (so `has:attachment` would wrongly drop every message). Production
// callers SHOULD pass a narrower client-domain-scoped query.
const DEFAULT_QUERY = 'in:inbox newer_than:60d';
const DEFAULT_MAX_MESSAGES = 25;
const DEFAULT_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.csv',
  '.xls',
  '.xlsx',
  '.qbo',
  '.ofx',
  '.png',
  '.jpg',
  '.jpeg',
];

export class GmailCloseFetcher implements CloseFetcher {
  readonly name = 'gmail' as const;
  private readonly base: CloseFetcher;
  private readonly gmail: GmailMcpServer;
  private readonly query: string;
  private readonly maxMessages: number;
  private readonly allowedExtensions: string[];

  constructor(args: GmailCloseFetcherArgs) {
    this.base = args.base;
    this.gmail = args.gmail;
    this.query = args.query ?? DEFAULT_QUERY;
    this.maxMessages = args.maxMessages ?? DEFAULT_MAX_MESSAGES;
    this.allowedExtensions = (
      args.allowedExtensions ?? DEFAULT_ALLOWED_EXTENSIONS
    ).map((e) => e.toLowerCase());
  }

  fetchEngagement(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ClientEngagement>> {
    return this.base.fetchEngagement(args);
  }

  fetchChecklist(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ChecklistItem[]>> {
    return this.base.fetchChecklist(args);
  }

  /**
   * Merge base-reported received docs with Gmail-detected attachments.
   * Each detected attachment is categorized against the engagement
   * checklist by keyword match (filename + message subject vs. the item's
   * label + category). Unmatched attachments surface as uncategorized
   * receipts (the skill already triages those for the operator).
   */
  async fetchReceivedDocs(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ReceivedDoc[]>> {
    const baseRes = await this.base.fetchReceivedDocs(args);
    // A base NOT_CONFIGURED/NOT_APPLICABLE is still recoverable here — we
    // can detect docs from email even when the portal isn't wired. Only a
    // hard base error short-circuits.
    const baseDocs =
      baseRes.ok
        ? baseRes.value
        : baseRes.error.code === 'NOT_CONFIGURED' ||
            baseRes.error.code === 'NOT_APPLICABLE'
          ? []
          : null;
    if (baseDocs === null) {
      return baseRes;
    }

    // Need the checklist to categorize attachments.
    const checklistRes = await this.base.fetchChecklist(args);
    const checklist = checklistRes.ok ? checklistRes.value : [];

    const listed = await this.gmail.listMessages({
      query: this.query,
      maxResults: this.maxMessages,
    });
    if (!listed.ok) {
      // Gmail read failed — fall back to whatever the base reported rather
      // than dropping the whole close. The skill's chase logic still runs.
      console.warn(
        `GmailCloseFetcher: listMessages failed (${listed.error.code}): ${listed.error.message} — using base docs only`,
      );
      return skillOk(baseDocs);
    }

    const gmailDocs: ReceivedDoc[] = [];
    const seen = new Set<string>();
    for (const summary of listed.value.messages) {
      const full = await this.gmail.getMessage({ messageId: summary.id });
      if (!full.ok) continue;
      const msg = full.value.message;
      const receivedAt = parseReceivedAt(msg.receivedAt);
      for (const att of msg.attachments) {
        if (!this.isAllowed(att)) continue;
        const dedupeKey = `${msg.id}:${att.filename}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const itemId = categorizeAttachment({
          filename: att.filename,
          subject: msg.subject,
          checklist,
        });
        gmailDocs.push({
          id: att.attachmentId
            ? `gmail-${msg.id}-${att.attachmentId}`
            : `gmail-${msg.id}-${slug(att.filename)}`,
          satisfiesChecklistItemId: itemId,
          receivedAt,
          filename: att.filename,
          source: 'gmail',
        });
      }
    }

    return skillOk([...baseDocs, ...gmailDocs]);
  }

  private isAllowed(att: MessageAttachment): boolean {
    const name = att.filename.toLowerCase();
    return this.allowedExtensions.some((ext) => name.endsWith(ext));
  }
}

// ── categorization ────────────────────────────────────────────────────────

/** Keyword hints per checklist category. Matched against the attachment
 *  filename + the message subject. Deliberately small + CPA-vernacular. */
const CATEGORY_HINTS: Record<string, string[]> = {
  'bank-statement': ['bank', 'statement', 'checking', 'savings'],
  'credit-card-statement': ['credit', 'card', 'amex', 'visa', 'mastercard'],
  'loan-statement': ['loan', 'note', 'mortgage', 'amortization'],
  'payroll-register': ['payroll', 'register', 'wages', 'paystub', 'gusto', 'adp'],
  'sales-tax-filing': ['sales tax', 'sales-tax', 'salestax', 'st-3', 'use tax'],
  'ar-ap-detail': ['aging', 'receivable', 'payable', 'ar ', 'ap '],
  'fixed-asset-changes': ['asset', 'depreciation', 'fixed asset'],
  'owner-distributions': ['distribution', 'draw', 'owner', 'k-1'],
  'inventory-count': ['inventory', 'count', 'stock'],
};

export function categorizeAttachment(args: {
  filename: string;
  subject: string;
  checklist: ChecklistItem[];
}): string | null {
  const hay = `${args.filename} ${args.subject}`.toLowerCase();

  // 1. Strongest signal: the attachment/subject mentions the item's label
  //    words. Score by how many label tokens match.
  let best: { id: string; score: number } | null = null;
  for (const item of args.checklist) {
    const labelTokens = tokenize(item.label);
    const labelHits = labelTokens.filter((t) => hay.includes(t)).length;
    const hints = CATEGORY_HINTS[item.category] ?? [];
    const hintHits = hints.filter((h) => hay.includes(h)).length;
    const score = labelHits * 2 + hintHits;
    if (score > 0 && (!best || score > best.score)) {
      best = { id: item.id, score };
    }
  }
  return best ? best.id : null;
}

function tokenize(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'your', 'this', 'that']);

function parseReceivedAt(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Convenience constructor so call sites read clearly. The Gmail MCP
 *  server is built by the caller via `buildGmailMcpServer({ workspaceId })`
 *  so this file never constructs one (keeps the vendor seam in one place). */
export function buildGmailCloseFetcher(args: GmailCloseFetcherArgs): GmailCloseFetcher {
  if (!args.gmail) {
    throw new Error('GmailCloseFetcher requires a Gmail MCP server');
  }
  return new GmailCloseFetcher(args);
}
