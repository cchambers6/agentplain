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
| QuickBooks            | ❌ stubbed-json   | `JsonCloseFetcher` accepts engagement + checklist + receipts |
| Gmail                 | ✅ built          | Doc-receipt detection via `MessageFetcher`; drafts via `DraftPersister` |
| Outlook (M365)        | 🔄 in-flight     | Provider-neutral `DraftPersister` — swap when ready        |
| TaxDome / Karbon      | ❌ stubbed-json   | Doc-portal events surface as `ReceivedDoc { source: 'taxdome' \| 'karbon' }` |

When the QuickBooks MCP lands, a `QuickBooksCloseFetcher` impl drops in alongside `JsonCloseFetcher` — **no skill code change** (per `feedback_runner_portability.md`).

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
