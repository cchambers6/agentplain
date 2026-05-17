# lead-triage-realestate

Vertical-specific skill: triage inbound real-estate leads (Zillow, Realtor.com, IDX, referrals, sphere).

## What it does

Given a workspace's inbound leads + agent roster + drip-campaign list, the skill:

1. **Fetches** leads via the `LeadFetcher` port.
2. **Scores** each lead on three signals — motivation, timeline, preapproval — into a deterministic composite (`motivation*0.4 + timeline*0.4 + preapproval*0.2`).
3. **Buckets** by composite:
   - `hot` ≥ 0.70
   - `warm` ≥ 0.45
   - `cold` ≥ 0.20
   - `nurture` < 0.20
4. **Routes**:
   - hot/warm → specific agent (specialty match → round-robin) or `manual` if no agent is accepting
   - cold/nurture → drip campaign for that audience, or `manual` if none configured
5. **Drafts** a first-touch reply using real-estate vernacular — preapproval, MLS#, showing windows. Operator-only routing context is included as a `{{operator-only — internal: ... }}` marker so it never leaks to the lead.
6. **Persists** drafts to the broker's email-drafts folder (Gmail / Outlook) via `DraftPersister` when confidence ≥ threshold. Per `project_no_outbound_architecture.md`, the skill **never sends**.

## Vertical scope

Real estate (`lib/verticals/real-estate/content.ts`). Tone grounded in `lib/skills/prompts/real-estate.ts` (warm but transactional; defer numeric specifics to the operator).

## MCP dependencies

| Provider         | Status            | Today                                                     |
| ---------------- | ----------------- | --------------------------------------------------------- |
| Follow Up Boss   | ❌ stubbed-json   | `JsonLeadFetcher` accepts `LeadRecord[]` + roster + drips |
| Gmail            | ✅ built          | Inbound surfaces via existing `MessageFetcher`            |
| Outlook (M365)   | 🔄 in-flight     | Provider-neutral `DraftPersister` — swap when ready       |

When the Follow Up Boss MCP lands, `FubLeadFetcher` drops in alongside `JsonLeadFetcher` — **no skill code change** (per `feedback_runner_portability.md`).

## Input / output shape

```ts
import { runSkill, JsonLeadFetcher } from '@/lib/skills/lead-triage-realestate';
import { RecordingDraftPersister } from '@/lib/skills/draft';

const fetcher = new JsonLeadFetcher({
  workspaceId: 'ws-123',
  leads: [
    {
      id: 'lead-1',
      fullName: 'Avery Patel',
      email: 'avery@example.com',
      phone: null,
      source: 'idx',
      inquiryText: 'Want to tour 4421 Magnolia Dr this week.',
      inquirySubject: null,
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: '7128341',
        addressText: '4421 Magnolia Dr, Atlanta',
      },
      statedTimeline: 'this week',
      statedFinancing: 'preapproved',
      receivedAt: new Date('2026-05-14T18:00:00Z'),
      hasBeenContacted: false,
    },
  ],
  agents: [
    { id: 'agent-a', name: 'Casey M.', specialties: ['first-time buyer'], serviceArea: 'Atlanta intown', acceptingLeads: true },
  ],
  campaigns: [
    { id: 'drip-nurture', name: '12-month nurture', audience: 'nurture' },
  ],
});

const result = await runSkill({
  workspaceId: 'ws-123',
  fetcher,
  persister: new RecordingDraftPersister(),
  now: new Date('2026-05-15'),
});

if (result.ok) {
  console.log(result.value.categoryCounts);  // { hot: 1, warm: 0, cold: 0, nurture: 0 }
  for (const t of result.value.triaged) {
    console.log(t.category, t.routing);
    console.log(t.firstTouchDraft?.body);
  }
}
```

## Architecture rules this skill respects

- `project_no_outbound_architecture.md` — drafts only. Persister writes to the drafts folder; no `send` method on the port.
- `feedback_no_silent_vendor_lock.md` — no FUB / Zillow / Gmail SDK imports in `skill.ts`. All upstream access goes through the `LeadFetcher` and `DraftPersister` ports.
- `feedback_runner_portability.md` — two implementations of `LeadFetcher` ship (`JsonLeadFetcher` here; `FubLeadFetcher` follows when the MCP lands).
- `feedback_no_quick_fixes.md` — end-to-end functional today. Scoring is deterministic with cited rules; first-touch draft is real-estate-specific (preapproval / MLS# / showing windows), not generic "thanks for reaching out" copy.
