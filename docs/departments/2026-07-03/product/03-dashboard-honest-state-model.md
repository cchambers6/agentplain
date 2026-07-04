# The honest-state model — five words a broker already knows

**Rule (ratified, PR #249; memory `feedback_customer_vocab_not_engineer`):** if a label describes the internal runtime state rather than the customer's experience, it is engineer vocabulary and must be translated before it reaches any customer surface. "ROOTING" and "LIVE" leaking onto the agents page is the founding incident; this document is the complete state model so nothing leaks again.

## 1. The five customer states

| State | Means (to the broker) | Chip + status line pattern |
|---|---|---|
| **Setting up** | "Plaino is getting this ready; first activity lands soon." | `Setting up — first activity lands soon` |
| **Watching** | "Ready and on duty; nothing has come in yet that needs doing." | `Watching — ready when a lead lands` (the noun names the trigger, per surface) |
| **Working** | "Actively producing; there is output to look at." | `Working — 3 drafts waiting for you` (always with the count when available) |
| **Needs a connector** | "Blocked on one wire; here is the wire." | `Needs a connector` badge + line naming the provider: `Connect Follow Up Boss to turn this on` — the badge is always a path forward, never a dead end |
| **Paused** | "Deliberately off; here is why and what turns it back on." | `Paused — drafting resumes when your pilot starts` (degraded mode); `Paused — you turned this off` (customer pause) |

One escape state, used sparingly: **Needs attention** — something failed and a human should look (`error/failed`, expired credentials mid-run). It is a flag, not a shrug: the line always names the one action ("Reconnect Follow Up Boss").

## 2. Internal → customer mapping (complete)

**Agent/skill runtime states:**
| Internal | Customer state |
|---|---|
| `live / running / active` | Working |
| `rooting / initializing / bootstrapping` | Setting up |
| `idle / waiting / ready-no-trigger` | Watching |
| `needs_input / blocked / requires-connector` | Needs a connector |
| `paused / disabled` (incl. LLM_DEGRADED_MODE for drafting agents) | Paused |
| `error / failed` | Needs attention |

**Integration/connector states:**
| Internal | Customer label |
|---|---|
| `ACTIVE` | connected (moss badge) |
| `available` | ready to connect (clay badge) |
| `EXPIRED / REVOKED` | reconnect needed (flag badge) |
| `ERROR` | needs attention (flag badge) |
| `coming-soon` | coming soon (muted badge) |

Internal slugs (`REALTY-LISTING-COORDINATOR`) may persist as identifiers; **status chips never do.** Chips pair with the PlainoStatus icon family only (never PlainoMark — the two-family split, PR #232).

## 3. The honesty invariants (what makes this model load-bearing, not cosmetic)

1. **A chip renders only from runtime-read data.** No static "live", no "Working" from a DB row that says a credential exists. The audit-10 finding — a "Test connection" that returns healthy from the row alone — is the anti-pattern; state is derived from the last actual read/verify, with its timestamp available on hover/tap.
2. **Working requires output.** If the count is zero, the state is Watching. "Working — 0 items" is a lie in a costume.
3. **Every blocked state names its unblock.** Needs a connector names the provider; Paused names the resume condition; Needs attention names the action. A state line without a next step fails review.
4. **Degraded mode is Paused, not broken.** The universal banner (PR #276) and every drafting agent's chip agree: watching and logging continue, drafting is paused, and the resume condition is stated. The product never demos its own outage as a malfunction — it narrates it as a deliberate state (which it is: the pause is policy).
5. **Demo mode is labeled.** The killer-workflow runtime on synthetic data never wears a Working chip; it wears a demonstration label. Working is reserved for the customer's real work.

## 4. Where each state appears

| Surface | What it shows |
|---|---|
| **Today** | The workspace's single headline state (the "what needs me" answer): Working with the approvals count when drafts wait; Watching when clear; Setting up during first hour; the demo runtime when `isDemoMode` |
| **Connections** | Per-connector labels (§2 table 2) + per-agent chips grouped under the connector that feeds them; every `Needs a connector` chip deep-links to that provider's connect path (through the disclosure) |
| **Reports** | States appear only historically ("Plaino was working on 41 items this week") — no live chips, since Reports answers "was it worth it", not "what's happening" |
| **Approvals cards** | The one place internal precision matters to the customer: each card names the agent, the action, and what approving causes — in the same vocabulary ("Approving sends nothing; it releases the draft to your Follow Up Boss") |

## 5. Transition narrative for the activation path (worked example)

Fresh RE workspace: everything **Setting up** (first hour) → killer-workflow card **Needs a connector — Connect Follow Up Boss** → key verified: connector **connected**, lead-triage agent **Watching — ready when a lead lands** → first after-hours lead: **Working — 1 draft waiting for you** + notification → broker approves → back to **Watching**, saved-time ledger +27 min. Under the paused key, the drafting step's chip reads **Paused — drafting resumes when your pilot starts** while catch/log stay Watching/Working. Five states, zero jargon, no state a broker has to ask about — that's the acceptance test.
