---
name: capability-builder
description: Turn a recurring pattern you've noticed across recent work into a reusable, installable skill. Use when you catch yourself (or the fleet) doing the same non-obvious thing more than twice — "we keep doing X the same way," "make this a skill," "extract this pattern." Guides you from observed pattern → extracted primitive → new SKILL.md in the right domain → catalog entry.
---

# Capability-builder (the meta-skill)

This skill builds other skills. When a pattern recurs, it walks you from "we keep doing this" to a self-contained, installed skill that any future session can load.

**The rule that gates everything below: no fabricated skills.** Every skill must trace to a *real, executed* pattern — cite the PR #, file path, or commit that seeded it. If you can't cite where the pattern actually ran, you don't have a skill yet; you have an idea. Write the idea down as a candidate, don't ship it as a skill.

## When to use — trigger phrases

- "we keep doing X the same way" / "this is the third time we've…"
- "make this a skill" / "extract this pattern" / "capability-builder, add …"
- reviewing recent PRs and noticing a repeatable primitive under the domain output

## Procedure

### 1. Identify the recurring pattern
Look across the last 1–2 weeks of real work (PRs, docs, retros, memory). A pattern qualifies when:
- it appeared **≥2–3 times**, and
- it is **non-obvious** (not "write good code"), and
- the *primitive* is separable from the *domain output* (the reusable move, not the specific deliverable).

Name it as a verb-phrase capability: "push from a headless session," "reconcile many plans into one sequence," "keep a fix PR scoped."

### 2. Extract the primitive
Strip the domain specifics. Ask: *what is the reusable move, independent of this week's task?* Write down:
- **Trigger phrases** — what a user would say to invoke it.
- **Inputs** — what the skill needs to run.
- **Procedure** — the steps, concretely.
- **Rules / guardrails** — the load-bearing constraints and the failure mode each one prevents.
- **Origin** — the real PR/file that seeded it (the no-fabrication citation).

### 3. Pick the domain directory
- `fleet-ops/` — build/push/schedule/memory mechanics.
- `orchestration/` — dispatching and coordinating agent passes.
- `governance/` — compliance/positioning/truth gates.
- `code-hygiene/` — PR discipline, migrations, scoped fixes.
If none fit, propose a new domain in the same PR (and say why in the catalog).

### 4. Generate the SKILL.md
Create `docs/skills/cowork/<domain>/<skill-name>/SKILL.md` with:
```md
---
name: <kebab-case-name>            # matches the directory
description: <one sentence: what it does + the trigger phrases that should invoke it>
---

# <Human title>

<1–2 sentence what/why>

## Procedure
<the concrete steps>

## Rules
<the load-bearing guardrails — each naming the failure it prevents>

## Origin
<the real PR#/file that seeded this — no-fabrication citation>
```
Keep it **self-contained**: a future session must be able to apply it from this file alone, with no repo checked out. Embed the procedure; don't just link to it.

### 5. Add a companion prose primitive (optional but preferred)
Write `docs/skills/patterns/<pattern>.md` with the fuller when-to-use / inputs / procedure / guardrails / worked-example treatment. The `cowork/` SKILL.md is the loadable version; the `patterns/` file is the library reference.

### 6. Append to the catalog
Add a row to `docs/skills/00-README.md` under the right domain: skill name, one-line purpose, and the seeding PR/file.

### 7. Gate and ship
- If the skill touches customer-facing wording, run the voice gate.
- Keep the PR docs-only (see `docs-only-pr`).
- Report back: the skill(s) added, the domain, and the seeding citation.

## Guardrails

- **No fabricated skills.** Cite the real pattern or don't write it. (This is the same discipline as the truth-wave check, applied to skills.)
- **Primitive, not deliverable.** If the "skill" only makes sense for this week's task, you extracted the output, not the pattern — go back to step 2.
- **Self-contained.** The SKILL.md must stand alone; assume the reader has neither this repo nor this conversation.
- **Name = directory.** The frontmatter `name` matches the folder, kebab-case, so the Skill tool resolves it.
- **Don't duplicate.** Check the catalog first; if a near-match exists, sharpen *it* instead of adding a twin (same dedup discipline as the librarian rollup).
- **Description earns the invocation.** The `description` is how the pattern gets matched to a user request — write the trigger phrases in, don't be vague.

## Worked example (filled in)

**The recurring pattern I noticed:** across the June–July fleet PRs, every single push happened the same non-obvious way — `gh` wasn't authenticated as the bot, so the session minted a short-lived token from a committed git credential helper, wrote it to a `0600` file (never stdout), pushed with `--force-with-lease` using the `x-access-token@github.com` URL form, then shredded the file. It showed up on PR #295–#306, #344, #355, #369 — far more than three times, non-obvious, and cleanly separable from whatever each PR actually changed.

**The primitive I extracted:** "push a branch from a headless/bot session with no interactive credential prompt." Trigger: "push as the fleet bot," "gh isn't logged in." Inputs: branch, base, repo. Procedure: mint → push-with-lease → shred. Guardrails: `--force-with-lease` never `--force`; token never in stdout/commit/PR body; helper needs `node_modules` on cwd; junction-first cleanup order.

**The SKILL.md it produced:** [`../fleet-ops/fleet-token-push/SKILL.md`](../fleet-ops/fleet-token-push/SKILL.md) — self-contained, cites the real `.get-token.mjs` + `scripts/git/agentplain-fleet-credential-helper.ts` (and explicitly flags that the once-referenced `scripts/mint-fleet-token.mjs` never existed, so nobody cites a ghost).

**The catalog entry it added:** a row under **fleet-ops** in `00-README.md` pointing at that skill and its seeding files.

That is the whole loop: observed ≥3×, non-obvious, separable → extracted the reusable move → self-contained SKILL.md in the right domain → catalog row → docs-only PR.

## Origin

This meta-skill generalizes how the 2026-07-08 skills catalog itself was built — every skill in `docs/skills/` was extracted from a real, cited pattern in the prior two weeks of fleet work, following exactly the seven steps above. It also mirrors the existing per-product `capability-builder` agents (e.g. `flatsbo-capability-builder`) that scout and level up other agents rather than doing specialist work themselves.
