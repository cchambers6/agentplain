# Sequencing critique — is the fleet doing things in the right order?

**Short answer: no.** The strategy layer is sequenced correctly on paper (Truth Wave → proof →
prospecting; front door before paid; RE before CPA/law). The *fleet's actual work order* over
the last 10 days inverts it. Four named errors, each with the fix.

## Error 1 — Introspection stacked five layers deep before execution of layer one

The chain since 2026-06-30: 20 product audits → 10 kaizen retros → kaizen master synthesis
(PR #343) → product-audit master synthesis (PR #344) → marketing + sales deep-dives (#345,
#346) → journey-loop system regenerating the same inventory continuously (#347) → CEO Pass 1 +
Chief-of-Staff Pass 1 (in flight, unlanded) → this planning session.

Each layer is individually good. Collectively, layers 3 through 8 largely *re-rank the same
top-20 fix table*, and the marginal insight per layer is now near zero: this session's top
findings (Connect dead-end, saved-time leak, empty Conner queue, entity) were all already in
layer 2. Meanwhile **zero items from the fix table have merged.** The master synthesis itself
ratified "fixes-only next, no new audit loops" — and then three more analysis layers fired.

**Fix:** hard stop on new analysis layers. Land the two in-flight passes (CEO, CoS), then the
next N fleet sessions are fix-wave sessions drawn from kaizen master §3 until the first five
are merged. The analysis debt is paid; start collecting on it.

## Error 2 — Expanding the loop before the loop has proven its one job

The 9-track non-stop expansion (local_fdd1beb2) is being built when:

- The 1-track journey loop has completed exactly **one pass** (seed); the governor has never
  ticked (`last_tick_at: null` in state.yaml — the scheduled task isn't created yet);
- **No backlog card has ever converted into a merged fix** — the loop→fix pipeline, the entire
  point of the system, is unvalidated end-to-end;
- The stop condition (`profitable_milestone_reached`) is undefined (see 02, gap 2).

Scaling a machine 9x before its output has been consumed once is building inventory of
inventory. And after Jul 7 the expansion's cost model changes from ~$0 to real dollars per
track per day, with no defined milestone to justify it.

**Fix:** the expansion lands as *dormant capacity* — prompts, schema, queue design merged but
not scheduled — until (a) "profitable" is defined in YAML with a data source, and (b) one
backlog card from the existing loop has shipped as a merged fix. Both are achievable this week.

## Error 3 — Proof depends on a chain nobody has walked to its first link

The dependency chain to revenue: fixes → market-ready → (with active prospecting) → key
un-pause → pilots → proof → paid conversion. Every link is documented; the *first* link (five
S-effort fixes) is unstarted, and the parallel human link (Conner's send rhythm, entity,
accounts) has no packaged decision set in front of Conner. The fleet has, in effect, built
links 4–7 in great detail while links 1–2 sit idle. Building marketing narrative, ad concepts,
and content plans (all done, all gated) before the front door works was tolerable while Fable
was free; continuing it isn't.

**Fix:** all fleet capacity to link 1 (start list, move 1); the Conner Decision Pack (move 2)
makes link 2 a one-sitting cost. Everything else queues behind those.

## Error 4 — flatsbo sequenced ahead of agentplain in the master fix plan

The product-audit master synthesis puts a flatsbo fleet-week (rows 1–8) before the agentplain
fleet-week (rows 9–14). That contradicts the ratified priority order: agentplain is THE
priority; flatsbo waits on RE license + counsel and is recommended for waitlist-dark mode. A
week of fleet capacity on a parked, revenue-incapable codebase — while agentplain's activation
path is broken — is the wrong order even though the flatsbo findings are individually real.

**Fix:** invert the two weeks. Exception a board member would grant: flatsbo's unauthenticated
PII endpoints are a live safety exposure on a public deployment — either fix those few
endpoints in a day or take the surface dark, then return to agentplain. Not a week.

## The right order, restated in one list

1. **Activation fix wave** (five named S/M fixes — start list move 1) → this is "market-ready"
   in miniature.
2. **Conner Decision Pack** (entity, accounts, rhythm commitment, contradictions — move 2) →
   unblocks "active prospecting."
3. **Outreach rhythm starts** (founder sends; fleet drafts into the approval queue weekly).
4. **Define "profitable" + wire the meters** (move 3) → gives the Jul 6 re-tier and every loop
   a real target.
5. **Pilots + proof** as partners sign; key un-pauses when both halves of the gate are true.
6. **Then** content cadence, loop expansion at scale, paid spend behind its existing gate, CPA/
   law reopening behind the 2-RE-pilots gate.

Nothing in this order is new — it is the order the strategy documents already claim. The
critique is that the fleet's revealed preference (what it actually spent Fable-hours on) has
been 6 → 4 → 1, and the correction is to run the list forward.
