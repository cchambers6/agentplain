# AI Headmaster POC — Hand-off Package (what the fleet needs from Conner)

One queue, defaults stated, silence-unsafe items flagged — consolidated-decision-queue discipline. Answer these and the fleet starts M0 the same day.

## Decisions

### D1. Tech stack approval
Next.js 15 + TypeScript + Prisma/Postgres (Neon) + Vercel; no queue/Redis/Inngest for POC; SSE chat; single-family password auth. Full justification doc 01 §1.
**Default if unanswered: approved as specified** (it is the fleet's fluent stack; the contrarian choices are all *removals* of infrastructure, reversible later).

### D2. Chat-first vs lightweight app
**Recommendation: lightweight web app whose daily surface is a chat thread** (doc 07 §1).
**Default if unanswered: the recommendation.**

### D3. Which 2–3 curricula to seed for the dry run — ⚠️ SILENCE-UNSAFE
Must be materials the live-dry-run family actually owns. Candidates (doc 07 §2): *Math with Confidence* · *The Good and the Beautiful Language Arts* · *Exploring Nature with Children*.
**No default fires. M0 (the bake-off, the first fleet-day) is blocked until answered.** If the real family's shelf differs from the candidates, the shelf wins.

### D4. Simulated vs live M6
**Recommendation: hybrid — simulated week 1, live family week 2** (doc 07 §3).
**Default if unanswered: the recommendation.**

## Access & logistics

### A1. GitHub: spawn `cchambers6/ai-headmaster` — ⚠️ blocking M1 (not M0)
- Create the repo **private** (the agentplain-was-public lesson, `project_founder_credibility_surface_2026_07_08`).
- Extend the existing GitHub App installation (the one whose credential helper the fleet uses via `.get-token.mjs`) to the new repo so fleet-token push + curl-per-PR works there; otherwise mint a fine-grained PAT scoped to the repo (contents+PRs read/write) and park it where the credential helper expects.
- Branch protection on `main`: PRs only, same as agentplain.

### A2. Anthropic API workspace — ⚠️ blocking M2
**Recommendation: a new workspace under the existing Anthropic org** (not a new org, not the agentplain key): separate key, separate spend reporting (the $10/family target needs clean attribution), workspace budget cap set to $50/mo for the whole POC. Key lands in Vercel env + `.env` local — never in the repo (`no-secrets-in-chat` / never-commit-secrets rules carry over).
**Default if unanswered:** fleet requests the workspace and parks the setup as a Conner-queue item; M2 blocks on the key existing.

### A3. Vercel + Neon projects — non-blocking until M1 deploy
New Vercel project + new Neon project (free tiers). Fleet can set these up with existing accounts unless Conner wants separation; flag if the answer is "separate accounts."

### A4. Legal / entity separation — decision needed before *revenue*, not before POC
The POC collects a real family's child-observation data in week 2 of M6. Minimum bar before that week: a plain-language consent note to the family (what's stored, where, that they can have it deleted) and the RLS/CI gate green. Entity separation from agentplain, ToS/privacy, and COPPA posture are **v1-blocking, not POC-blocking** — but the counsel review slot should be booked when D-decisions land, because agentplain's own counsel gate (`project_legal_head_plan_2026_07_03`) showed that queue is the long pole. **Recommendation:** run the POC under Conner personally with the consent note; incorporate/assign before first paying family.

### A5. The live family — needed by M6 week 2
Identity of the POC family (presumably known to Conner), their curricula shelf (feeds D3), and their commitment to ~10 school days of ≤5-min loops plus one 20-min onboarding sitting.

## What the fleet does the day this lands

1. D3 answered → M0 bake-off runs (1 fleet-day, in agentplain, docs-only).
2. A1 done + M0 passed → repo spawned from doc 05 scaffold; M1 starts.
3. A2 done → M2 wiring; M3–M5 sequential; M6 scheduled with the A5 family.
4. Weekly one-paragraph status to Conner (report-back discipline, `docs/skills-v2/cowork/orchestration/report-back/SKILL.md`); the only mid-build escalations are kill-criteria trips (doc 00) or new silence-unsafe decisions.
