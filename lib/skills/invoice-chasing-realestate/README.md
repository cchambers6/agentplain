# invoice-chasing-realestate

Vertical-specific skill: chase unpaid commission invoices for a real-estate brokerage.

## What it does

Given a workspace's open invoices and the contacts they belong to, the skill:

1. **Reads** open invoices via the `InvoiceFetcher` port.
2. **Filters** out invoices that don't need chasing — paid, void, disputed, not yet due, or covered by a negotiated extension.
3. **Buckets** the survivors by days outstanding:
   - `warm` — 1–14 days past due
   - `firm` — 15–30 days past due
   - `escalate` — 31+ days past due
4. **Drafts** a tier-appropriate reminder using real-estate-specific tone — references commission, closing, MLS#, and respects the broker / title-company / cooperating-broker / attorney relationship.
5. **Persists** drafts to the broker's email-drafts folder (Gmail / Outlook) via the existing `DraftPersister` port when confidence ≥ threshold. Per `project_no_outbound_architecture.md`, the skill **never sends**.

## Vertical scope

Real estate (`lib/verticals/real-estate/content.ts`). Copy is grounded in `lib/skills/prompts/real-estate.ts` tone guidance (warm but transactional; defer numeric specifics to the operator).

## MCP dependencies

| Provider         | Status       | Today                                      |
| ---------------- | ------------ | ------------------------------------------ |
| QuickBooks       | ❌ stubbed-json | `JsonInvoiceFetcher` accepts generic `InvoiceRecord[]` |
| Follow Up Boss   | ❌ stubbed-json | `JsonInvoiceFetcher` accepts generic `ContactRecord` map |
| Gmail            | ✅ built      | Drafts persist via `lib/integrations/google/gmail-provider.ts` |
| Outlook (M365)   | 🔄 in-flight | Provider-neutral `DraftPersister` — swap in when ready |

When the QuickBooks MCP lands, a `QuickBooksInvoiceFetcher` implementation of `InvoiceFetcher` drops in alongside `JsonInvoiceFetcher` — **no skill code change** (per `feedback_runner_portability.md`).

## Input / output shape

```ts
import { runSkill, JsonInvoiceFetcher } from '@/lib/skills/invoice-chasing-realestate';
import { RecordingDraftPersister } from '@/lib/skills/draft';

const fetcher = new JsonInvoiceFetcher({
  workspaceId: 'ws-123',
  invoices: [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-04-117',
      contactId: 'c-1',
      closingReference: '4421 Magnolia Dr — MLS 7128341',
      amountCents: 1_250_000,
      currency: 'USD',
      issuedAt: new Date('2026-04-15'),
      dueAt:    new Date('2026-04-30'),
      status: 'open',
      lastActivityAt: null,
      negotiatedExtensionUntil: null,
    },
  ],
  contacts: {
    'c-1': {
      id: 'c-1',
      name: 'Sarah Mitchell',
      email: 'sarah.mitchell@example-title.com',
      kind: 'title-company',
      phone: null,
    },
  },
});

const result = await runSkill({
  workspaceId: 'ws-123',
  fetcher,
  persister: new RecordingDraftPersister(), // omit for in-memory-only drafts
  now: new Date('2026-05-15'),
});

if (result.ok) {
  console.log(result.value.bucketCounts);  // { warm: 0, firm: 1, escalate: 0 }
  for (const f of result.value.followUps) {
    console.log(f.tier, f.draft.subject);
    console.log(f.draft.body);
  }
}
```

## Architecture rules this skill respects

- `project_no_outbound_architecture.md` — drafts only. Persister writes to the drafts folder; no `send` method exists on the port.
- `feedback_no_silent_vendor_lock.md` — no QuickBooks / Follow Up Boss / Gmail SDK imports in `skill.ts`. All upstream access goes through the `InvoiceFetcher` and `DraftPersister` ports.
- `feedback_runner_portability.md` — two implementations of `InvoiceFetcher` ship (`JsonInvoiceFetcher` here; a `QuickBooksInvoiceFetcher` follows when the MCP lands).
- `feedback_no_quick_fixes.md` — end-to-end functional today. Body templates are real-estate-aware (commission / closing / cooperating broker) — not generic AR copy.
