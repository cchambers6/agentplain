# Head of Product — 14-day plan (2026-07-03 → 2026-07-17)

**Mandate:** design product FOR profitable. One persona (Georgia real-estate broker-owner / agent), one activation path, one killer workflow, one honest dashboard. Everything else is frozen (05).

**Ratified frame this plan operates inside (2026-07-03):**
- CEO lever: Conner sends 5 Georgia RE design-partner emails Monday (2026-07-06).
- GTM = RE only until 2 pilots are live. No LLM-dependent features while the prod key is paused. No new surface area. Client portal off.
- Loop mandate: design for profitable — no analysis-only output. Every item below is a shippable change or a named decision.

**Sources:** CEO Pass 1 (`docs/ceo/2026-07-02/`, branch `ceo/pass-1-2026-07-02`), audit master synthesis (`docs/audits/full-audit-2026-07-02/MASTER-SYNTHESIS.md`), product kaizen (`docs/kaizen/2026-07-02/02-product.md`), sales plan (`docs/sales/deep-dive-2026-07-02/`), RE journey map + profitability lens (`docs/journeys/2026-07-02/real-estate--broker-owner.md`, `docs/profitability/2026-07-02/real-estate.md`), and code (`lib/workflows/`, `lib/plaino/killer-workflow.ts`, `lib/demo/demo-mode.ts`, `lib/workspace/nav.ts`).

---

## 1. The product thesis for the next 14 days

The product is not the constraint — distribution is (CEO 00). But the moment distribution fires, the product becomes the constraint **at exactly one seam: the first five minutes.** The advertised 5-minute first-value path has been audited as dead at the Connect button (journey `real-estate.activation.connect.1`; audit 05 P1-5). Conner's five emails on Monday will, if the funnel math holds, produce a discovery call within 2–4 weeks and a prospect in the product shortly after. Product's whole job in this window is to make sure that first prospect's first sitting converts — because at ~$185 contribution per RE seat, cash-breakeven is 3–9 customers (CEO 01), and every one of them enters through this same five minutes.

So the plan is one sentence: **make the first five minutes of a Georgia RE broker's trial provably work, on today's degraded-mode reality, and make the dashboard tell the truth about it.**

## 2. The one metric

**Time-to-first-drafted-value (TTFDV): a new RE workspace sees a drafted first-touch in its Approvals queue, or the demo runtime completing on synthetic data, within 5 minutes of signup — measured, not asserted.**

Secondary: demo→connect rate (workspaces that click the killer-workflow Connect CTA), connect→live rate (credential verified), and the honest-state floor (zero engineer-vocab or false "live" labels on customer surfaces).

## 3. Day-by-day

### Days 1–3 (Fri–Sun, before the Monday sends)
| # | Item | Doc | Status / owner ask |
|---|---|---|---|
| 1 | Verify the FUB/api-key Connect fix is **merged and read back on main** — memory records it fixed in the send-path wave (PR #355) but the audit-era dead-end is the single activation killer if it isn't on main | 01 §4 | Engineering (04 §2, ask E1) |
| 2 | Route the marketplace tile + killer-workflow-card Connect CTAs through the #306 data-disclosure page (audit 05 P0-2) — the RE persona is liability-conscious; the disclosure is a selling point, not friction | 01 §4 | Engineering E2 |
| 3 | Trial + card truth: every buy-moment surface consumes `lib/billing/facts.ts`; kill the 30d-vs-7d and "no card required" contradictions (audit 10 P1-10/11) before a skeptical broker reads them | 01 §3 | Engineering E3, one Conner decision (7d vs 30d) already queued |
| 4 | Demo mode leads the first impression: confirm `isDemoMode` gates the Today tab to the killer-workflow runtime for a fresh RE workspace and the runtime autoplays (no click needed to see value) | 01 §5, 02 §5 | Product verifies; Design polish ask D1 |

### Days 4–7 (send week)
| # | Item | Doc | Status / owner ask |
|---|---|---|---|
| 5 | Saved-time writers on all 7 calibrated actions + sweep persist paths, and bound the Day-7 guarantee window (audit 09 P0-1). This is margin defense — the only recurring dollar leak — and the proof surface the first pilot's case study reads from | 06 §3 | Engineering E4 |
| 6 | Honest-state model shipped: the five customer-vocab states (03) rendered from runtime-read data on Today + Connections; degraded mode reads as an honest "Paused — drafting resumes when your pilot starts", never as breakage | 03 | Engineering E5, Design D2 |
| 7 | Activation funnel instrumented: 5 events (signup → workspace → demo-viewed → connect-started → first-draft-queued), so TTFDV is a number by the time the first prospect hits the funnel | 04 §4 | Data ask DA1 |

### Days 8–14 (first replies expected)
| # | Item | Doc | Status / owner ask |
|---|---|---|---|
| 8 | Approval-loop closure for the RE daily rhythm: notify on all approval-creation paths, queue count + pagination, web reject-with-reason (journey `daily-use.morning.2/4/5`) — the retention loop for a broker who checks their phone between showings | 06 §4 | Engineering E6 |
| 9 | Prospect-feedback intake: every discovery call produces a ranked delta against 01 (what the broker expected vs what the path does). First real market data re-ranks this plan; the plan yields to it | — | Product + Conner's call notes |
| 10 | Prod-key un-pause readiness (product side): the moment Conner books a discovery call, the first live pilot workspace must activate same-day — pre-verify the demo→live cutover in 02 §6 | 02 §6 | Engineering E7 + Conner decision 3 (CEO 04) |

**Not in this plan:** everything in 05. If an item isn't in the tables above or in the freeze list, it waits.

## 4. Definition of done (adopted from the kaizen, enforced here)

Every item above lands only when it is (a) merged to main and read back, (b) reachable — a UI entry point exists, (c) measured — its event or writer fires. "Merged ≠ shipped" is the disease this product caught three audits in a row (kaizen friction 1); the cure is applied to this plan first.

## 5. Risks

- **The send lever slips.** If Monday's five emails don't go, TTFDV has no customer to measure. Product cannot fix this; the plan still hardens the funnel for whenever it fires.
- **#355 not on main.** The activation path's keystone. Day-1 verification, not assumption (kaizen: read-back rule).
- **Degraded mode misread by prospects.** Mitigated by 02 §5 (demo state is deterministic and honest) and 03 (Paused state copy). The demo never fakes an LLM; it plays a calibrated story on synthetic data and says so.
