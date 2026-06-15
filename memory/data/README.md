# memory/data — Librarian-managed YAML data layer

These five YAML files are the persistent data layer for the agentplain 5-tier operating loop.
**Do not write to them directly from outside the Librarian.**

## Files

| File | Purpose | Updated by |
|------|---------|------------|
| `session-costs.yaml` | Per-session model + tokens + cost + outcome | Librarian on session completion |
| `cv-bar-scores.yaml` | Per-PR customer-value self-score + reasoning | Librarian when a scored PR lands |
| `calibration.yaml` | Prompt patterns, model routing, waste rules | Librarian weekly roll-up |
| `conner-queue.yaml` | Pending Conner decisions + resolved archive | Any session via INBOX; Librarian processes |
| `budget-state.yaml` | Week-to-date burn per tier + cap status | Librarian on session completion |

## Write contract

All writes go through `memory/inbox/`. Drop a YAML payload there; the Librarian picks it up on its 15-minute cadence and merges it into the appropriate file. This keeps writes serialized and prevents concurrent-session clobbers.

```
memory/inbox/
  YYYYMMDD-HHMMSS-<type>.yaml   # e.g. 20260615-093000-session-cost.yaml
```

## Reading from code

Use `lib/memory/data-readers.ts` — typed async functions, no custom YAML parsing needed:

```ts
import {
  readSessionCosts,
  readCvBarScores,
  readCalibration,
  readConnerQueue,
  readBudgetState,
  canSpend,
} from '@/lib/memory/data-readers';

// Gate before firing an expensive Tier 2 session:
const { ok, reason } = await canSpend(2, 300);
if (!ok) throw new Error(`Budget gate: ${reason}`);

// Pull the Conner decision queue for the morning brief:
const blockers = await readConnerQueue({ priority: 'blocker' });
```

## Schema versions

All files carry `schema_version: 1`. If the schema changes, bump the version and add a migration note here.
