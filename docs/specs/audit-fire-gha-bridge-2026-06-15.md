# Spec — audit-fire GHA bridge (the long-term autonomy path)

**Version:** 0.1 (spec only — NO implementation in this PR) · **Authored:** 2026-06-15 · **Owner:** the fleet · **Ratifier:** Conner
**File of record:** `docs/specs/audit-fire-gha-bridge-2026-06-15.md`
**Companion (short-term):** `C:\Users\conne\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions\e96926c9-f6b4-447c-b651-556629bc1f98\3e6a77a8-104b-4774-8239-85aac4c3463b\agent\memory\data\pending-fires.yaml` + the Librarian "Pending-fires pickup protocol" (`C:\Users\conne\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions\e96926c9-f6b4-447c-b651-556629bc1f98\3e6a77a8-104b-4774-8239-85aac4c3463b\agent\memory\LIBRARIAN_CHARTER.md`)
**Process source:** `docs/specs/AGENTPLAIN_OPERATING_SYSTEM_2026_06_15.md` (Tier-2 autonomous polish)

---

## The problem

The Tier-2 `agentplain-audit-queue-autofire` scheduled task can triage the audit queue but cannot **fire** work: `mcp__dispatch__start_code_task` is not reachable from its VM. Two consequences:

1. Today, every fire round-trips through the **Dispatch parent**, which only runs when Conner is messaging. **Autonomy stops the moment Conner goes quiet.**
2. The short-term file-bridge (`pending-fires.yaml` → Librarian claims → Dispatch parent fires) closes the *correctness* gap (no fire is lost) but **not the latency gap**: a P1 still waits for Conner's next message before it actually fires.

This spec describes the path that removes the human/Dispatch round-trip entirely: audit-fire triggers a GitHub Actions workflow that owns full dispatch reach, fires the work, and returns the PR URL — **truly off-grid autonomy**.

## Why `repository_dispatch` (not `workflow_dispatch`)

`workflow_dispatch` is a *manual* trigger (UI/CLI, requires an interactive identity). `repository_dispatch` is the **API-driven** trigger: a single authenticated `POST` with a JSON payload starts a workflow run with no human in the loop. The audit-fire task already runs unattended on a schedule, so the API trigger is the right seam. (The deliverable title says "workflow_dispatch path" loosely — the correct GitHub primitive for an unattended API-driven start is `repository_dispatch`; if a manual fallback is ever wanted, the same workflow can also declare a `workflow_dispatch` trigger.)

## The flow

```
┌──────────────────────────┐
│ agentplain-audit-queue-  │  Tier-2 scheduled task (Cowork VM).
│ autofire (triage)        │  Triages audit queue; scores cv-bar; picks fires.
└──────────┬───────────────┘
           │ dispatch reachable?
           │
   ┌───────┴────────┐
   │ NO (today)     │ YES (after this spec ships)
   ▼                ▼
SHORT-TERM       POST https://api.github.com/repos/cchambers6/agentplain/dispatches
file-bridge:       { "event_type": "audit-fire",
append to            "client_payload": { id, title, cwd, model,
pending-fires.yaml      budget_cap_usd, prompt, cv_bar_score, severity } }
   │                      │
   │                      ▼
   │            ┌──────────────────────────────┐
   │            │ .github/workflows/            │  Triggered on:
   │            │ audit-fire.yml                │    repository_dispatch:
   │            │ (GHA runner — full reach)     │      types: [audit-fire]
   │            └──────────┬───────────────────┘
   │                       │ runs a Claude Code session (headless) with
   │                       │ mcp__dispatch__start_code_task in scope
   │                       ▼
   │            fire the work → open PR (do NOT merge) → capture PR URL
   │                       │
   │                       ▼
   │            write result back: POST a status comment / update
   │            pending-fires.yaml entry to status: fired + pr_url
   ▼
Librarian claims → Dispatch parent fires on Conner's next message
(short-term path stays as the FALLBACK when GHA is unavailable)
```

The two paths coexist: the GHA path is the primary once shipped; the file-bridge remains the durable fallback (cold-start-safe, I-1) for when the GHA trigger fails or the runner is unavailable.

## Payload contract

The `client_payload` mirrors a `pending-fires.yaml` entry (same fields, same names) so the two paths are interchangeable and a fire can be replayed from either source:

```json
{
  "event_type": "audit-fire",
  "client_payload": {
    "id": "fire-2026-06-15T22-30-00Z-plaino-paused-banner",
    "title": "Plaino-paused universal banner",
    "cwd": "C:\\agentplain",
    "model": "claude-opus-4-8",
    "budget_cap_usd": 80,
    "prompt": "<full self-contained prompt — quotes the audit item verbatim, says open a PR / do not merge, states the cap>",
    "cv_bar_score": 5,
    "severity": "P1"
  }
}
```

> Note: `cwd: C:\agentplain` is a Windows-local path meaningful to the Dispatch/Cowork environment. A GHA runner is Linux and checks out the repo fresh, so the workflow ignores `cwd` and operates on its own checkout — `cwd` is carried only for parity/replay with the file-bridge path.

## What this PR does NOT do

No `.github/workflows/audit-fire.yml`, no POST code in the audit-fire task, no secrets created. This is the spec only. Implementation is a follow-up wave, gated on Conner provisioning the secrets below.

## Implementation checklist (for the follow-up wave)

1. **Workflow file** `.github/workflows/audit-fire.yml` triggered on `repository_dispatch: types: [audit-fire]`. Steps: checkout → set up Node/Claude Code → run a headless Claude Code session seeded with `client_payload.prompt` and the dispatch MCP in scope → open PR → write back result.
2. **POST seam** in (or alongside) the audit-fire task: when dispatch is unreachable, POST `repository_dispatch` instead of (or in addition to) the file-bridge append. Keep the file-bridge append as the fallback if the POST is non-2xx.
3. **Result write-back**: the workflow updates the matching `pending-fires.yaml` entry to `status: fired` + `pr_url` (or `status: failed` + reason), so both paths converge on one ledger.
4. **Guardrails carried into the workflow prompt**: open a PR / do not merge (I-12), self-score 4+ or no PR (I-3), worktree off main (I-8), budget cap from payload, no prod key restore (I-6).

## Secrets / env vars needed (Conner provisions)

| Name | Where | Purpose |
|------|-------|---------|
| `ANTHROPIC_API_KEY` | GHA repo/environment secret | The headless Claude Code session in the runner needs a key. **This is a NEW, GHA-scoped key — NOT the paused prod key (I-6).** Scope/budget-limit it to fleet-build use. |
| `FLEET_DISPATCH_PAT` | GHA secret | Fine-grained PAT used to POST `repository_dispatch` from the audit-fire task and to open PRs from the runner. |
| `GITHUB_TOKEN` | auto-provided by GHA | Default token for the runner's repo operations (checkout, PR via `gh`). |

## Permissions required

- **`repository_dispatch` POST** (from the audit-fire task): a token with `contents: write` (fine-grained PAT, `FLEET_DISPATCH_PAT`) on `cchambers6/agentplain`.
- **Workflow `permissions:` block** in `audit-fire.yml`:
  ```yaml
  permissions:
    contents: write        # checkout + push the fire branch
    pull-requests: write   # open the PR
  ```
- **Branch protection**: the runner opens PRs only; it must NOT have merge rights to `main` (I-12 — the fleet does not merge).

## Open questions for Conner

1. **New GHA-scoped Anthropic key** vs keeping all firing inside Cowork — the GHA path requires a key in the runner. (I-6 says the *prod* key stays paused; this is a separate, budget-capped, GHA-only key.)
2. **Concurrency cap**: how many audit-fire workflow runs may execute at once (recommend `concurrency: audit-fire` + a max-parallel of 1–2 to respect the Tier-2 daily budget cap in `budget-state.yaml`).
3. **Whether the file-bridge stays on permanently as the fallback** (recommended: yes — cold-start-safe, no single point of failure).
