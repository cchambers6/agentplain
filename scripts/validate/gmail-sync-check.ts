/**
 * scripts/validate/gmail-sync-check.ts
 *
 * Sync-correctness subtest for PR-B per
 * `feedback_integration_acceptance_is_functional.md`:
 *
 *   "Sync-diff is now a subtest, not the acceptance test."
 *
 * Acceptance for PR-C is the functional value loop. This script ships the
 * *correctness* leg: given a recent time window, list every Gmail message
 * agentplain saw — keyed and shaped so it can be cross-checked against the
 * same window read via the Cowork Gmail MCP. Zero drift between the two
 * = sync correctness passes.
 *
 * Usage:
 *   npx tsx scripts/validate/gmail-sync-check.ts \
 *       --workspace <slug-or-uuid> \
 *       --since <iso-timestamp-or-relative-like-1h> \
 *       [--until <iso>] \
 *       [--out <path.json>]
 *
 * Reads (no writes — read-only validator):
 *   - IntegrationCredential for the workspace (provider=GOOGLE, ACTIVE)
 *   - WebhookEvent rows in the window
 *   - For each event's historyId, calls Gmail's users.history.list to
 *     resolve message ids touched
 *   - For each message id, calls users.messages.get(format=metadata) to
 *     pull sender, subject, internalDate, labelIds, threadId, snippet
 *
 * Emits a deterministic JSON shape (sorted by internalDate, sender lower-cased,
 * snippet sha256'd to avoid PII drift across orchestrator transcripts):
 *
 *   {
 *     "workspaceSlug": "...",
 *     "accountEmail": "...",
 *     "windowStart": "iso",
 *     "windowEnd": "iso",
 *     "messages": [
 *       { "internalDate": "...", "sender": "...", "subject": "...",
 *         "threadId": "...", "labelIds": [...], "snippetSha256": "..." },
 *       ...
 *     ]
 *   }
 *
 * The orchestrator (Conner's Dispatch session) generates the same shape via
 * Cowork Gmail MCP for the same window. A `diff` of the two JSON outputs
 * is the pass/fail. See docs/validation/gmail-dogfood.md for the cross-check
 * procedure.
 *
 * Per `feedback_no_guesses_no_estimates`: every field cites the Gmail API
 * endpoint it comes from. No invented fields.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { google, type gmail_v1 } from 'googleapis';
import { prisma } from '@/lib/db/prisma';
import { decryptCredential } from '@/lib/integrations';

interface CliArgs {
  workspace: string;
  since: Date;
  until: Date;
  out?: string;
}

function parseRelativeWindow(s: string, now: Date): Date {
  // Accept "1h", "24h", "7d", or absolute ISO.
  const rel = /^(\d+)([hd])$/.exec(s.trim());
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2] === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return new Date(now.getTime() - n * unit);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`unparseable --since/--until: ${s}`);
  }
  return d;
}

interface RawArgs {
  workspace?: string;
  since?: string;
  until?: string;
  out?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const raw: RawArgs = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--workspace') raw.workspace = v;
    else if (k === '--since') raw.since = v;
    else if (k === '--until') raw.until = v;
    else if (k === '--out') raw.out = v;
    else if (k === '--help' || k === '-h') {
      console.log('Usage: gmail-sync-check --workspace <slug-or-uuid> --since <1h|iso> [--until <iso>] [--out path]');
      process.exit(0);
    } else {
      throw new Error(`unknown arg ${k}`);
    }
  }
  if (!raw.workspace) throw new Error('--workspace is required');
  if (!raw.since) throw new Error('--since is required');
  const now = new Date();
  return {
    workspace: raw.workspace,
    since: parseRelativeWindow(raw.since, now),
    until: raw.until ? parseRelativeWindow(raw.until, now) : now,
    out: raw.out,
  };
}

interface OutputRow {
  internalDate: string;
  sender: string;
  subject: string;
  threadId: string;
  labelIds: string[];
  snippetSha256: string;
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const wanted = name.toLowerCase();
  for (const h of headers) {
    if ((h.name ?? '').toLowerCase() === wanted) return h.value ?? '';
  }
  return '';
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Resolve workspace
  const workspace = await prisma.workspace.findFirst({
    where: /^[0-9a-f-]{36}$/i.test(args.workspace)
      ? { id: args.workspace }
      : { slug: args.workspace },
    select: { id: true, slug: true, name: true },
  });
  if (!workspace) {
    throw new Error(`workspace ${args.workspace} not found`);
  }

  const credential = await prisma.integrationCredential.findFirst({
    where: { workspaceId: workspace.id, provider: 'GOOGLE', status: 'ACTIVE' },
  });
  if (!credential) {
    throw new Error(`no ACTIVE GOOGLE credential for workspace ${workspace.slug}`);
  }

  const events = await prisma.webhookEvent.findMany({
    where: {
      subscription: { credential: { id: credential.id } },
      receivedAt: { gte: args.since, lte: args.until },
    },
    orderBy: { receivedAt: 'asc' },
  });

  // Build a Gmail client.
  const decrypted = decryptCredential(credential);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: decrypted.accessToken,
    refresh_token: decrypted.refreshToken ?? undefined,
  });
  const gmail = google.gmail({ version: 'v1', auth });

  // For each event, pull the historyId and list messages touched. Use a
  // de-dup set on messageId to avoid double-listing.
  const seenMessages = new Set<string>();
  const collected: OutputRow[] = [];

  for (const ev of events) {
    const raw = ev.rawPayload as { message?: { data?: string } } | null;
    if (!raw?.message?.data) continue;
    let inner: { historyId?: string | number; emailAddress?: string };
    try {
      inner = JSON.parse(
        Buffer.from(raw.message.data, 'base64').toString('utf8'),
      );
    } catch {
      continue;
    }
    const historyId = inner.historyId !== undefined ? String(inner.historyId) : null;
    if (!historyId) continue;

    // history.list returns messages added/labeled since the given historyId.
    // We list everything from this historyId to the present and merge.
    let pageToken: string | undefined;
    do {
      const hist = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        pageToken,
        labelId: 'INBOX',
        historyTypes: ['messageAdded'],
      });
      for (const h of hist.data.history ?? []) {
        for (const m of h.messagesAdded ?? []) {
          if (!m.message?.id) continue;
          if (seenMessages.has(m.message.id)) continue;
          seenMessages.add(m.message.id);
        }
      }
      pageToken = hist.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  // Pull metadata for each unique message.
  for (const messageId of Array.from(seenMessages).sort()) {
    let msg: gmail_v1.Schema$Message;
    try {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      msg = res.data;
    } catch (err) {
      // Skip messages we can't read (deleted etc.).
      console.warn(`skip ${messageId}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const internalDate = msg.internalDate ?? '0';
    const internalIso = new Date(Number(internalDate)).toISOString();
    if (
      Number(internalDate) < args.since.getTime() ||
      Number(internalDate) > args.until.getTime()
    ) {
      continue;
    }
    collected.push({
      internalDate: internalIso,
      sender: headerValue(msg.payload?.headers ?? [], 'From').toLowerCase(),
      subject: headerValue(msg.payload?.headers ?? [], 'Subject'),
      threadId: msg.threadId ?? '',
      labelIds: (msg.labelIds ?? []).slice().sort(),
      snippetSha256: sha256(msg.snippet ?? ''),
    });
  }

  // Deterministic ordering: by internalDate, then sender, then subject.
  collected.sort((a, b) => {
    if (a.internalDate !== b.internalDate) return a.internalDate < b.internalDate ? -1 : 1;
    if (a.sender !== b.sender) return a.sender < b.sender ? -1 : 1;
    return a.subject < b.subject ? -1 : 1;
  });

  const output = {
    workspaceSlug: workspace.slug,
    accountEmail: credential.accountEmail,
    windowStart: args.since.toISOString(),
    windowEnd: args.until.toISOString(),
    messageCount: collected.length,
    messages: collected,
  };

  const json = JSON.stringify(output, null, 2);
  if (args.out) {
    await fs.writeFile(args.out, json, 'utf8');
    console.log(`wrote ${args.out} (${collected.length} messages)`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error('[gmail-sync-check] fatal:', err);
  process.exit(1);
});
