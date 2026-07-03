# Journey map — {vertical} / {persona}

<!-- Emitted by L1 (weekly Fable journey-mapper). One file per vertical × persona.
     Path: docs/journeys/<run-date>/<vertical>--<persona-slug>.md
     Schema: memory/data/loop/schema.yaml → journey (schema_version 1)
     Internal doc: model names allowed here; NEVER copy phrasing to customer surfaces
     without a voice-gate pass (docs/brand/voice-guidelines-2026-06-19.md). -->

**Run date:** {YYYY-MM-DD} · **Produced by:** {model id} · **Schema:** v1

## Persona

One paragraph: who this person is, what their day looks like, what they pay for
today. **Every persona claim must cite a source** (sales scripts, outbound pack,
support tickets, audits). If the persona is inferred from marketing targeting
rather than observed customers, say so and mark `persona_source: "TODO: real
signal needed"` — that TODO is itself a gap L3 may surface.

## Stage-by-stage map

One `###` section per stage, in order: awareness → consideration → signup →
activation → daily-use → expansion → renewal → advocacy. Skip a stage only with
an explicit "not applicable because …" line.

### {stage}

**Micro-moment: {moment id} — {one-line description}**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| As a {persona} at {moment}, I want {want} | {kind}: {ref} | yes / partial / no / not-in-scope | {code path or doc} — or `gap: {what is missing}` |

Rules for the table:
- Wants are written in the customer's own vocabulary (Setting up / Working /
  Watching — never engineer labels).
- `Signal` cites at least one defensible source per Truth Wave. `todo-real-signal`
  is allowed but counts as a gap.
- `Evidence` for a **yes** is a code path or shipped doc. A verdict with no
  evidence is not a verdict — downgrade to `partial` with `gap:`.

## Machine block

Fenced `yaml` block conforming to `journey` in the schema. This is what L2 and
L3 actually read — the prose above is for humans; disagreement between the two
is a bug in the map.

```yaml
vertical: {vertical}
persona: {persona-slug}
persona_source: {path or TODO}
run_date: {YYYY-MM-DD}
produced_by: {model id}
stages: []
```

## Cross-vertical clusters observed

Bullet list of `cluster:` slugs this map contributed to, with the sibling
verticals seen so far. L1 maintains cluster continuity run-over-run by reading
the previous week's maps first.
