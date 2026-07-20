# agentplain — repo instructions

## Model routing (ratified 2026-07-19)

Canonical plan: memory `project_model_routing_plan_2026_07_19` (companion:
`feedback_fable_is_max_default_2026_07_19`). Fable is Max-plan-included at 50%
share — no longer scarce; it is the default heavy-lift model. Every session,
agent, and scheduled task picks its tier from this tree BEFORE spawn:

1. Merge or config change with clear scope → **Sonnet** (`claude-sonnet-5`)
2. Watchdog / curl / triage / decision gate → **Haiku** (`claude-haiku-4-5-20251001`)
3. Shipping code requiring judgment → **Fable** (`claude-fable-5`)
4. Planning / synthesis / audit → **Fable**
5. Genuinely 1M-context, or Fable unavailable → **Opus 4.8** (`claude-opus-4-8`)
6. In doubt → **Fable**

Session-level policies:

- **Fable**: no cap, quality over burn, verification-heavy, PRs
  ready-for-review (not draft), curl-verified deploys.
- **Sonnet**: bounded to the brief, no exploration, report exact steps.
- **Haiku**: 1-shot, deterministic, no follow-ups within the same run.
- **Every session**: rebase-first before push; no `HUSKY=0` bypass unless
  explicitly approved; `NODE_OPTIONS=--max-old-space-size=8192` standing for
  builds; if the permission classifier blocks a network call, hand back the
  one-click compare URL and stop.

Supersedes the 2026-07-08 "Opus 4.8 default / Fable only on explicit ask"
ruling (`feedback_back_to_opus_2026_07_08`).
