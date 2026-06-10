# month-end-close-cpa

Vertical-specific skill: coordinate a CPA-firm month-end close for a single client engagement.

Anchors the doc-chase workflow that the CPA opportunity analysis (`b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4) cites as consuming ~25% of staff hours through tax season.

## What it does

Given a workspace + client + period, the skill:

1. **Fetches** the engagement, the per-period doc checklist, and the receipts already in hand via the `CloseFetcher` port.
2. **Categorizes** every checklist item into `received` / `pending` / `late` (with `daysPastDue`).
3. **Surfaces** receipts that didn't match any checklist item — the staff triages those as a separate step.
4. **Drafts a single batched chase email per recipient** for the outstanding required items. Optional items are tracked but never chased — CPA tone is professional, never harassing.
5. **Proposes a calendar reminder** (default 3 days out) for the second touch. Per `project_no_outbound_architecture.md`, the customer's calendar system schedules — we propose.
6. **Drafts a single client-facing status update** for the partner-or-CSM to send: an all-clear note when every required item is in and the partner has signed off, otherwise an in-flight summary that defers the partner-review turnaround to an operator merge field.
7. **Persists** drafts to the firm's email-drafts folder via `DraftPersister` when confidence ≥ threshold. The skill **never sends** — `messages.send` does not appear anywhere in the file.

## Vertical scope

CPA (`lib/verticals/cpa/content.ts` — CSM + Staff accountant JTBD rows). Tone grounded in `lib/skills/prompts/cpa.ts`:

> CPA replies are formal + careful. NEVER state a tax position, refund amount, or balance due in a draft — defer with `{{operator: tax position}}` or `{{operator: refund/balance amount}}`.

## MCP dependencies

| Provider              | Status            | Today                                                      |
| --------------------- | ----------------- | ---------------------------------------------------------- |
| QuickBooks            | ✅ built          | `QuickBooksCloseFetcher` — engagement from the customer record; templated checklist; no received-doc concept (everything pending/late) |
| Gmail                 | ✅ built          | `GmailCloseFetcher` auto-detects emailed doc attachments via the Gmail MCP port + categorizes them; drafts via `DraftPersister` |
| TaxDome               | ✅ built          | `TaxdomeCloseFetcher` — engagement from the client record; templated checklist; **real received-doc portal** maps client uploads → received/uncategorized |
| Karbon                | ✅ built          | `KarbonCloseFetcher` — engagement from the active workflow; **checklist IS the firm's Karbon jobs** (real wording, real due dates); a `done` job → synthetic receipt |
| Outlook (M365)        | 🔄 in-flight     | Provider-neutral `DraftPersister` — swap when ready        |

All five `CloseFetcher` impls (`Json`, `Gmail`, `QuickBooks`, `Taxdome`, `Karbon`) share the same port — **no skill code change** per `feedback_runner_portability.md`.

### Honest contract-coverage delta (TaxDome + Karbon, cv-cpa wave)

The TaxDome/Karbon read contracts are read-only and narrower than the checklist wants. What each derives HONESTLY (see the per-file HONESTY BAR blocks):

- **TaxDome** — strong on RECEIVED DOCS (`listReceivedDocuments` returns real client uploads with status); has **no structured checklist** (we template it from scope, same as QuickBooks) and **no contact-role / cc / sign-off** fields (defaults: `owner`, `[]`, `partnerSignoff: false`). Uploads that don't keyword-match a checklist item surface as **uncategorized receipts** rather than a false "received".
- **Karbon** — strong on the CHECKLIST: jobs ARE the checklist (real titles + due dates). Has **no doc portal**, so a `done` job becomes a synthetic receipt labelled "(marked complete in Karbon)" — honest provenance, never implies an attached file. No active workflow for the client → `NOT_APPLICABLE` (nothing in flight to close).

The **Gmail-attachment doc detector** (`GmailCloseFetcher`) is the upgrade that closes TaxDome's checklist gap and Karbon's doc gap by reading the docs clients actually email — gated on Gmail consent.

### GmailCloseFetcher (wave-5, theme #12 / ratif #7)

Before wave-5, `fetchReceivedDocs` had no real source, so the close kept chasing
documents the client had already **emailed**. `GmailCloseFetcher` composes over a
base fetcher (engagement + checklist from `JsonCloseFetcher` / QuickBooks) and
overrides `fetchReceivedDocs` to scan the client's inbox via the Gmail MCP port,
detect document attachments (PDF / spreadsheet / CSV / statement images), and
categorize each against the checklist by filename + subject keyword overlap.
Gmail-detected docs **merge** with portal docs; unmatched attachments surface as
uncategorized receipts for the operator. A Gmail read failure degrades to
base-only docs — the close never drops.

```ts
import {
  GmailCloseFetcher,
  JsonCloseFetcher,
} from '@/lib/skills/month-end-close-cpa';
import { buildGmailMcpServer } from '@/lib/integrations/gmail-mcp';

const fetcher = new GmailCloseFetcher({
  base: quickBooksOrJsonFetcher,
  gmail: buildGmailMcpServer({ workspaceId }),
  query: `has:attachment from:@${clientDomain} newer_than:60d`,
});
```

## Input / output shape

```ts
import { runSkill, JsonCloseFetcher } from '@/lib/skills/month-end-close-cpa';
import { RecordingDraftPersister } from '@/lib/skills/draft';

const fetcher = new JsonCloseFetcher({
  workspaceId: 'ws-123',
  clientId: 'client-acme-llc',
  periodMonth: '2026-04',
  engagement: {
    clientId: 'client-acme-llc',
    clientName: 'Acme LLC',
    primaryContact: { name: 'Patricia Lin', email: 'pat@acme.example.com', phone: null, role: 'controller' },
    ccContacts: [{ name: 'Mike Chen', email: 'mike@acme.example.com', phone: null, role: 'bookkeeper' }],
    periodMonth: '2026-04',
    scope: 'full-stack-monthly',
    internalDeadline: new Date('2026-05-20'),
    partnerSignoff: false,
  },
  checklist: [
    { id: 'item-bank', label: 'April 2026 bank statement', category: 'bank-statement', dueAt: new Date('2026-05-08'), required: true },
    { id: 'item-cc',   label: 'April 2026 credit card statement', category: 'credit-card-statement', dueAt: new Date('2026-05-12'), required: true },
  ],
  receivedDocs: [
    { id: 'doc-1', satisfiesChecklistItemId: 'item-bank', receivedAt: new Date('2026-05-09'), filename: 'bank-2026-04.pdf', source: 'gmail' },
  ],
});

const result = await runSkill({
  workspaceId: 'ws-123',
  clientId: 'client-acme-llc',
  periodMonth: '2026-04',
  fetcher,
  persister: new RecordingDraftPersister(),
  now: new Date('2026-05-15'),
});

if (result.ok) {
  console.log(result.value.bucketCounts);   // { received: 1, pending: 0, late: 1 }
  console.log(result.value.chaseEmails[0].body);
  console.log(result.value.statusUpdate.body);
  console.log(result.value.reminders);      // [{ reminderOnLocalDate: '2026-05-18', ... }]
  console.log(result.value.closeReady);     // false (partnerSignoff=false)
}
```

## Architecture rules this skill respects

- `project_no_outbound_architecture.md` — drafts only. Persister writes to the drafts folder; reminder is PROPOSED (the customer's calendar schedules); no `send` method on any port used here.
- `feedback_no_silent_vendor_lock.md` — no QuickBooks / TaxDome / Karbon / Gmail SDK imports in `skill.ts`. All upstream access goes through the `CloseFetcher` and `DraftPersister` ports.
- `feedback_runner_portability.md` — two implementations of `CloseFetcher` ship (`JsonCloseFetcher` here; `QuickBooksCloseFetcher` follows when the MCP lands).
- `feedback_no_quick_fixes.md` — end-to-end functional today. Chase email is CPA-vernacular ("April 2026 month-end close", "engagement letter", "partner review"); never states a tax position.
