# Cost Envelope — the Two-Week Fable Plan (2026-07-11)

Everything here is a **labeled estimate** (`feedback_no_guesses_no_estimates`: estimates are allowed when labeled and calibrated). Pricing figures are the published API rates (Claude API reference, cached 2026-06-24): Fable 5 $10/$50 per MTok in/out; Opus 4.8 $5/$25; Sonnet 5 $3/$15 (introductory $2/$10 through 2026-08-31); Haiku 4.5 $1/$5. Cache reads ≈0.1× input rate; cache writes 1.25× (5-min TTL). Session-shape calibration: this audit session itself, and the M2 smoke's measured ~$0.13/agent-run (PR #383) for the *product's* runtime — which is not what we're pricing here; we're pricing the *build* sessions.

## Session cost model (the assumption to check against reality)

A heavy Fable build session (corpus or codebase loaded, multiple deliverable files): assume ~3–6M input tokens across the session, of which 70–85% are cache reads, plus ~150–400K output tokens. That prices to roughly:

- input: ~0.8–1.5M full-rate equivalent tokens → $8–15
- output: 150–400K × $50/M → $8–20
- **≈ $16–35 per heavy session; call it $25 mid, $40 for corpus-heavy (C6-class)**

A Sonnet 5 wiring/verification session, same shape at intro pricing: **≈ $5–12**.

These are point estimates with wide error; the first week's actual metered spend should replace them (the same discipline that replaced the $5.76/family guess with M2's measured $0.13/run).

## The two-week plan, priced

| Bucket | Sessions | Hours (est.) | $ (est.) |
|---|---|---|---|
| Fable — A1+A2, C1×2(+C4), C5 (in-session), C6×2, C3 (half), C2×2, C7, C8+A4, buffer/F1 (half) | ~9.5 | ~28–32 | **$230–340** |
| Sonnet 5 — M3/M4 wiring, P0 fixes, M5 Registrar, pack build/verify, dry-run scaffolding | ~6 | ~18 | **$40–70** |
| Opus 4.8 — two independent judge passes (C3) | ~0.3 | ~1 | **$5–10** |
| **Total** | ~16 | ~47–51 | **≈ $275–420** |

Event-driven adds (A3 pricing-response tree on a live reply): +1 Fable session, +$25–35 — the best marginal dollar in the whole plan if it fires, since it services an actual prospect.

## Three alternatives compared

### (a) Skip Fable entirely — everything on Sonnet 5

Direct cost: ~$100–160. Real cost: the deliverables in this plan are prompts, judgment rubrics, citation-verified corpus work, and customer-facing prose. On mechanical work Sonnet is a straight substitute; on these it isn't — the failure mode is not "worse wording" but **rework**: an extractor prompt that fabricates evidence fails acceptance criterion 3 in M6 and forces a redo two weeks later; a pack with a mis-attributed Mason quote fails `pack:verify` or, worse, passes and misleads a parent. One redo cycle of C1 or C6 erases the entire $130–180 saved. The CM pack precedent is instructive: PR #385's 48 verified citations against 700–860KB source volumes is work Sonnet-class models historically needed multiple passes and heavy human review to match.

### (b) Everything on Opus 4.8

Direct cost: ~$140–210 (half Fable's token rates). Opus 4.8 is genuinely strong on this class of work, and for perhaps a third of the queue (C7 voice pass, C8/A4 pipeline design, A3 branches) it's a defensible substitute. The items where the Fable premium is most clearly bought: C1's extractor (multi-source judgment where subtle fabrication is the failure mode), C6 (contradiction-heavy corpus at full-volume scale), and A1 (cross-cutting interaction bugs across runbook+seed+spine in one context). The premium for keeping those on Fable over Opus is roughly **$60–100 across the fortnight** — less than one hour of the founder's time spent debugging a subtly wrong child-model pipeline.

### (c) Recommended mix (this plan)

Fable on the ~9 judgment/prose/corpus sessions; Sonnet 5 on wiring, fixes, and Registrar; Opus 4.8 where independence is the point (judge passes) and as the fallback tier if Fable availability or budget tightens — with C7/C8/A4 the first items to demote to Opus. Total **≈ $275–420 for the fortnight**, i.e., roughly one-tenth of a single month of one design partner at Partner-tier list price ($299/mo ×12 annualized) and a rounding error against the Chiron POC's ~13 fleet-days.

## Standing rule going forward

Route by deliverable type, not by product: prompts-parents-or-partners-read, judgment rubrics, citation-verified corpus, cross-cutting rehearsals → Fable. Wiring, migrations, fixes, mechanical extraction, ports → Sonnet 5 (or Haiku for pure grind). Independent verification passes → Opus 4.8. The `06-not-for-fable.md` list operationalizes the negative half of this rule.

Two accounting notes: (1) wire `stampSessionCost()` rows (unified plan 0.12) to tag the model tier, so this envelope gets replaced by measured numbers at the Jul-24 buffer; (2) the model-transition ruling (unified plan 1.4) governs *fleet default* rates — this plan's Fable sessions are explicit, per-item purchases, consistent with that ruling, not a reversal of it.
