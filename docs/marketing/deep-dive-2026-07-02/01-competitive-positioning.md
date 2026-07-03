# Competitive positioning per vertical — where agentplain wins

**Frame (ratified, do not drift):** agentplain is a **service partnership**, not software. The comparison story is vendor-generic: **"DIY vs. run-for-you."** We never position against our model supplier, never confirm or deny which model runs underneath, and never claim a live integration that isn't wired (per `docs/marketing/CREATIVE_PACK_GROUND_TRUTH.md` — live integration story today is email + calendar + QuickBooks, plus DocuSign/Drive on the realty stack).

**The universal line:** every tool below is a **system of record** — it stores, organizes, and reminds. The work between the records (reading the inbox, drafting the reply, chasing the missing document, writing the status update) is still done by a human at 9pm. agentplain sits **beside** the system of record and does that work as drafts a human approves. We don't replace the incumbent; we take the typing out of it.

**The honest concession (keep it — it builds trust, per the `/compare` pattern from #289):** each section names where the incumbent wins first. A rigged grid reads as hype and we don't do hype.

---

## 1. Real estate — vs. Follow Up Boss, Sierra, BoldTrail

**What they are:** CRM and lead-conversion platforms. Follow Up Boss is the team CRM of record; Sierra couples IDX websites with CRM; BoldTrail (the kvCORE successor) is the big-brokerage all-in-one with automation and AI-flavored lead nurture.

**Where they win first:** pipeline of record, lead routing, IDX/website, drip campaigns at volume, MLS-adjacent tooling. If the pain is "my leads aren't organized," buy one of these first. Many of our best customers will already run one — good.

**What they can't do (and we do):**
- **Run it for you.** All three are DIY: someone at the brokerage builds the automations, writes the templates, maintains the pipelines. We install, configure, and run a monthly review — a service with a person behind it, not a login and a help center.
- **Work across the whole desk.** They act inside their own walls. The broker's actual day spans inbox + calendar + QuickBooks + transaction docs. The fleet reads across those and drafts the in-between work: first-touch replies to inbound leads, commission-invoice chasing, overnight transaction summaries, the monthly report.
- **Compliance before send, with a human in the loop.** Their automation *sends*; ours *drafts*. A fair-housing slip in an auto-sent drip is a $26,262 first-offense HUD penalty. Our sentinel reviews drafts against the fair-housing corpus and a person approves everything. An auto-send tool structurally cannot offer this.
- **A flat, affordable service price.** Team CRMs price per seat and climb with add-ons. Regular is $199/seat sliding to $99 — with the service included.

**One-line position:** *"Keep your CRM. We do the work around it — drafted for you, approved by you."*

## 2. CPA firms — vs. TaxDome, Karbon

**What they are:** practice-management suites — client portals, workflow templates, e-signatures, task tracking. TaxDome owns the small-firm portal motion; Karbon owns team workflow and email-triage for mid-size firms.

**Where they win first:** the system of record for engagements, client portal, e-sign, recurring workflow templates, team visibility. A firm drowning in "where is this return?" should have one.

**What they can't do (and we do):**
- **Do the chasing, not just track it.** Practice management tells you the client hasn't sent the documents. The fleet **drafts the chase email**, drafts the status update to the client, drafts the onboarding letter — and a credentialed person approves each one. The workflow tool records that work exists; we do the work.
- **Month-end and AR as drafts.** QuickBooks is wired today: AR aging summarized, open-invoice follow-ups drafted, month-end status written up — landing in the queue on a cadence.
- **A stakes-aware review posture.** Preparer-penalty exposure (Circular 230 / §6694 territory, $1,000–$5,000 per return) means nothing client-facing should auto-send. Our whole architecture is that nothing does.
- **Run-for-you at solo-practitioner prices.** Karbon's motion assumes a firm that can staff workflow administration. We assume the opposite: a 1–10-person firm with nobody spare to run software. 14-day trial for CPA firms, card at signup, 14-day money-back.

**One-line position:** *"TaxDome tracks the work. We draft it."*

## 3. Law firms — vs. Clio, MyCase, Filevine

**What they are:** legal practice management — matters, billing, documents, client comms. Clio is the category default for small firms; MyCase bundles simplicity and payments; Filevine goes deep on litigation workflow at larger firms.

**Where they win first:** the matter system of record, time and billing, trust accounting, client portal. Non-negotiable infrastructure for a firm; we do not compete with it.

**What they can't do (and we do):**
- **Draft the routine correspondence a lawyer signs.** Status updates, intake follow-ups, doc-request chases — the fleet drafts them in the firm's voice, an attorney approves. Practice management gives you the template; we give you the finished draft with the matter context read in.
- **A deterministic intake conflict screen with the legal conclusion left to the lawyer.** Our intake workflow runs the adverse-party check and drafts the internal notice with the conclusion as a merge field — the professional judgment stays with the professional. That division of labor *is* the product.
- **Confidentiality-first data posture.** Rule 1.6 exposure makes "we copied your client files into our database" a dealbreaker. Our architecture is pass-through: memory persists for the account's life, raw tool data is read where it lives, not warehoused (`project_two_bucket_data_positioning_2026_06_18`). Say it exactly that way — never "we store nothing," which is banned as an overclaim.
- **A service relationship, not another admin login.** Small firms don't have practice administrators. We are the practice administrator, on a subscription.

**One-line position:** *"Clio holds the matter. We handle the correspondence around it — drafted, never sent without an attorney."*

## 4. Property management — vs. Buildium, AppFolio, DoorLoop

**What they are:** PM accounting-and-operations platforms — rent roll, leases, maintenance tickets, owner statements. AppFolio at scale, Buildium mid-market, DoorLoop the fast challenger.

**Where they win first:** the ledger. Rent collection, owner disbursements, maintenance dispatch, lease records. Every PM needs one; we integrate around it, not against it.

**What they can't do (and we do):**
- **The correspondence layer.** Late-rent notices that are firm but human, owner updates that don't take an evening to write, delinquency follow-ups drafted on a cadence and approved by the manager. The platform holds the balance; someone still has to write the email.
- **Fair-housing-aware drafting for tenant comms.** Tenant-facing language carries the same discrimination exposure as sales copy. Drafts get a compliance review pass and a human approval before anything leaves. (Runtime truth: the live fair-housing scanner today covers real estate; PM copy says "reviewed against your rules" — see the claims-linter rule in the executive plan. Never claim the live scanner for PM until `BASELINE_LIVE_VERTICALS` includes it.)
- **Owner-level ROI at a per-door-free price.** PM software prices per unit and rises with the portfolio. We price per seat — the manager, not the doors. ~$36,000/yr in PM-hour and delinquency reclamation is the cited math (`lib/verticals/property-management/content.ts`).

**One-line position:** *"AppFolio keeps the ledger. We write everything the ledger can't."*

## 5. General (all other local businesses) — vs. DIY AI, a hired assistant, an agency

This is the `/compare` motion (#289) and it stays the same story:

- **vs. DIY AI (chat tools):** a chat window answers when you ask. Nothing happens when you don't. The fleet works on a cadence — it reads what's already in your tools and drafts without being prompted, and remembers your business between sessions. DIY wins first on price ($0–20/mo) and on one-off questions; it loses on cadence, memory, integration, and the approval queue. We never frame a model vendor as a competitor — the comparison is with *running it yourself*, whatever you run.
- **vs. hiring an assistant:** a good assistant wins on judgment, phones, and physical-world tasks — say so. They cost $3,000–4,500/mo, need managing, take vacations, and leave with their training. The fleet is $99–199/seat, works the cadence every day, and its memory of your business persists for the life of the account.
- **vs. an agency:** an agency wins for one-time projects with big budgets. For the always-on drafting work, agencies bill hours against it forever. We productized it.

**One-line position:** *"The easy way to actually use AI in a local business: we run it, you approve it."*

---

## Rules for anyone using this document

1. **Name competitors only on comparison surfaces** (`/compare/[alt]`, sales conversations, this doc). Never in hero copy, never disparagingly, and always with the honest "where they win first" beat.
2. **Never claim integration with any tool named above.** Follow Up Boss, Sierra, BoldTrail, TaxDome, Karbon, Clio, MyCase, Filevine, Buildium, AppFolio, DoorLoop are all **roadmap**, not wired. The live story is email + calendar + QuickBooks (+ DocuSign/Drive for realty). "Works alongside" is the truthful verb.
3. **Never confirm or deny the model underneath.** The value is the service layer; the model is invisible on customer surfaces (`feedback_model_vendor_invisible_on_customer_surfaces`).
4. **Keep the monthly competitive-intel scan honest.** This document decays; the kaizen retro's improvement #5 (monthly scan feeding `/compare` and this file) is its maintenance contract. Anything here older than a quarter gets re-verified before it's used in-market.
