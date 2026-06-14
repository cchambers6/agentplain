# Support — IA audit

> Scope: the **Support** tab (`/support`) — in-app Plaino support chat, the
> "Get help" / open-a-ticket flow (`/support/new`), my-tickets list
> (`/support/tickets`), and the ticket thread (`/support/tickets/[ticketId]`)
> — plus the legacy **`/help`** route, assessed for the 13→~5 tab IA
> simplification. Planning only; no code touched.

## What this tab IS today

Support is **three overlapping things wearing one name**, and it eats **two of
the 13 nav slots**:

- **`/support`** (`support/page.tsx`) — a full-page **Plaino chat** surface.
  Renders `PlainoSupportChat` (`components/support/PlainoSupportChat.tsx`),
  which talks to `/api/chat` with `mode=support`. Below the chat sits a thin
  hand-off line: "Need a person on it? open a tracked ticket … your tickets."
- **`/support/new`** (`support/new/page.tsx` + `NewTicketForm.tsx`) — the
  **tracked-ticket** form. Nav-labelled **"Get help."** Subject + category
  (Billing / Workflow / Integration / Bug / Other) + description. On submit it
  returns a real ticket **#number**, an SLA window ("Expected first response:
  …"), and emails a copy. This is a first-class channel with status/priority
  badges.
- **`/support/tickets`** (`tickets/page.tsx`) — **"My tickets"** list: number,
  subject, status + priority badge, category, opened-date. Empty state nudges
  to `/support/new`.
- **`/support/tickets/[ticketId]`** (`tickets/[ticketId]/page.tsx`) — the
  **ticket thread**: `TicketThread`, an SLA banner (`slaLine` — honest, owns a
  breach: "We're past our target response time … flagged for a teammate"), and
  a `CustomerReplyForm` unless the ticket is CLOSED.

And separately, off-nav:

- **`/help`** (`help/page.tsx` + `HelpForm.tsx`) — a **non-tracked "message
  your service partner"** note form (subject + body, no category, no ticket
  number, no SLA). It explicitly positions itself as "not a ticket queue, a
  partner who knows your ground." It shows a `RecentStatusBanner`
  (drafted-under-review vs submitted) via `getSupportRecentStatus`. It is
  **not in `NAV`** (`layout.tsx`) — reachable only from onboarding
  `StuckHelpLink` deep links (`?subject=`).

So one customer job ("I need help") is spread across **four entry points and
two data models** (a `SupportRequest` note via `lib/support` vs a `Ticket` via
`PrismaTicketStore`).

## Customer job (JTBD)

> "I'm a local-business owner. Something is confusing, broken, or I have a
> billing question. I want one obvious place to ask, get a fast answer if it's
> simple, and a human who owns it (with a way to follow up) if it's not."

The owner does **not** distinguish "quick chat" from "tracked ticket" from
"note to my partner" — that's an internal/engineering distinction. They want
**one door**: ask Plaino, and if Plaino can't close it, a person picks it up
and they can see where it stands. Three forms with near-identical "subject /
what's going on" fields is the product showing the customer its own plumbing.

## Duplications

1. **`/support` vs `/support/new` are two nav tabs for one job.** "Support"
   (chat) and "Get help" (ticket) sit adjacent in `NAV`. The chat page already
   links to the ticket form; the ticket form already links "chat with {partner}
   instead." They cross-reference each other because they're the same job.
   **Collapse to one nav entry.**

2. **`/help` is a near-dead duplicate of `/support/new`.** Same hero motif
   (`lone-tree`), same "subject + free-text" shape, same "a hand when you need
   one" framing — but it produces an **untracked** `SupportRequest` instead of
   a numbered `Ticket` with an SLA. It is **not in nav**; its only inbound
   links are onboarding `StuckHelpLink`s. It is a *predecessor* of the ticket
   system that was never removed. **Recommend killing it** and repointing the
   onboarding deep links at `/support/new?subject=…` (the ticket form already
   takes a subject and gives the customer a tracked number — strictly better
   than the note form for a stuck-in-onboarding moment).

3. **Two support data models.** `SupportRequest` (note, `lib/support`,
   `submitSupportRequest`) and `Ticket` (`PrismaTicketStore`). The note model
   exists only to feed `/help` + the chat draft-into-review path. Consolidating
   on tickets removes a whole parallel store from the customer surface.

4. **Three "tell us what's wrong" forms** (`NewTicketForm`, `HelpForm`, and the
   chat's "send to team" panel) all converge on the operator review queue. One
   intake, three skins.

## Relationships

- **→ Talk to Plaino (`/talk`, bucket B).** This is the load-bearing one.
  `/support` is *literally a Plaino chat* over the **same `/api/chat`
  backbone**, differing only by `mode=support` vs the `/talk` mode
  (`project_plaino_chatbot_two_surfaces`). To the customer, "ask Plaino a
  question" on `/talk` and "ask Plaino for help" on `/support` are the
  same gesture. Having both is a duplicated chat surface.
- **→ Approvals / operator review queue.** Every support path (chat draft,
  ticket, note) lands a human-reviewed draft in the operator queue — nothing is
  auto-sent to the customer (`project_no_outbound_architecture`). Support is an
  *intake* into the same review machinery the rest of the product uses.
- **→ Account chrome (billing/settings).** "Billing" is a ticket category;
  billing questions are a top support job. Support is adjacent to the Account
  bucket but is broader than chrome.
- **→ Onboarding.** `StuckHelpLink` is the only live consumer of `/help`.

## What's broken or confusing

- **Two adjacent nav tabs ("Support", "Get help") for one job** dilute the 13
  and will dilute the target 5. (`layout.tsx` lines 29–30.)
- **Silent paused-LLM degrade in the in-app chat.** When spend is paused,
  `/api/chat` returns `PLAINO_PAUSED_REPLY` (`lib/plaino/degraded-copy.ts`)
  **with a `degraded: true` flag** and `expandLeadCapture`. But
  `PlainoSupportChat.tsx` **ignores the `degraded`/`expandLeadCapture` flags**
  — it renders `json.reply` as an ordinary Plaino turn. Result: a **signed-in**
  owner sees *"Plaino's resting just now … leave your email below and we'll be
  in touch"* — **marketing-widget copy that asks an already-logged-in customer
  for their email**, with **no email field rendered** and **no nudge toward the
  tracked-ticket path that still works**. The one moment the customer most
  needs the human channel, the surface quietly fails to point at it. Flag as a
  real bug for the merge, not just IA.
- **Engineer-vocab leak in the ticket form.** `NewTicketForm` category labels
  include **"Bug"** and **"Integration"** — engineer words on a customer
  surface (PR #249 vocab rule). An owner thinks "something's wrong" / "a tool
  isn't connecting," not "Bug" / "Integration."
- **Two competing promises.** `/help` says "**not a ticket queue**, a partner
  who knows your ground"; `/support/new` says "Open a **ticket** … you'll get a
  ticket **number**." The product can't decide whether it does tickets — and
  ships **both** messages.
- **Mode mismatch.** `PLAINO_PAUSED_REPLY` / lead-capture is correct for the
  *public marketing widget* but wrong for the *signed-in* support surface.

## What's working

- **The ticket thread is genuinely good and customer-true.** `slaLine` is
  calm-heritage voice and **owns a breach honestly** ("We're past our target
  response time … Sorry for the wait") rather than hiding it — exactly the
  brand-v2 posture. Status/priority badges, reply form, closed-state CTA all
  read like a partner, not a queue.
- **No-outbound discipline is intact** across all three paths — every reply is
  human-reviewed before it reaches the customer.
- **SLA + ticket number + email confirmation** is the right trust mechanic and
  worth keeping as the spine of a unified Support.
- **The chat → ticket hand-off line already exists** — the merge is mostly
  *deletion*, not new building.

## Verdict

**MERGE INTO bucket E (Account), with the chat layer folded into bucket B
(Plaino).**

Concretely — collapse four entry points into **one** customer-facing door:

- **Kill `/help`** entirely (dead/duplicative predecessor). Repoint onboarding
  `StuckHelpLink` at `/support/new?subject=…`. Retire the `SupportRequest`
  note model from the customer surface; keep only `Ticket`.
- **Drop the two separate nav tabs.** Support is not a daily-job tab — it's
  *chrome*. It belongs under **Account (E)** alongside billing, settings, team
  — i.e. a single **"Help & support"** item, not two top-level slots.
- **Don't keep a second standalone chat at `/support`.** Because `/support` is
  just Plaino chat (`mode=support`) over the same backbone as **Talk to Plaino
  (B)**, the *conversational* answer-my-question job should live in **B**, with
  a built-in "this needs a person → open a ticket" hand-off. The **tracked
  ticket + thread** (the durable, human-owned, SLA'd part) is the piece that
  lives under **Account (E)** as "Help & support."

Net: **2 nav tabs + 1 dead route → 0 top-level tabs.** Chat job absorbed by B;
tickets become a chrome item under E.

## Migration notes

1. **Nav:** remove both `{ "/support", "Support" }` and
   `{ "/support/new", "Get help" }` from `NAV` (`layout.tsx`). Add a single
   **"Help & support"** entry inside the Account (E) bucket pointing at the
   ticket list (`/support/tickets`).
2. **Routes:** keep `/support/tickets` and `/support/tickets/[ticketId]`
   (the good part). Repurpose `/support/new` as the single intake. **Delete
   `/help`, `/help/HelpForm.tsx`, `/help/actions.ts`**; redirect `/help` →
   `/support/new` (preserve `?subject=`) so existing onboarding links don't
   404. Update `StuckHelpLink` to target `/support/new`.
3. **Chat:** move the conversational surface (`PlainoSupportChat` +
   `mode=support`) under **Talk to Plaino (B)** as a "get help" mode/entry,
   rather than a standalone `/support` page. The "send this to the team" panel
   becomes "open a ticket," writing a `Ticket` (not a `SupportRequest`).
4. **Fix the silent paused-degrade (do this regardless of IA):**
   `PlainoSupportChat` must read the `degraded` / `paused` flags from
   `/api/chat` and, when paused/degraded, render an **in-app**, signed-in
   message — *"Plaino's resting — open a tracked ticket and a human will follow
   up the same day"* with a button to `/support/new` — **not** the marketing
   "leave your email" copy. Don't ask a logged-in owner for their email.
5. **Vocab:** rename ticket categories to customer words — "Bug" → "Something's
   wrong"; "Integration" → "A tool isn't connecting" (PR #249).
6. **Copy reconciliation:** pick one promise. Recommend keeping the **tracked**
   framing (ticket #, SLA, email-on-reply) — it's the stronger trust mechanic —
   and retire the "not a ticket queue" line from the dead `/help`.
7. **Data:** plan a one-time migration of any open `SupportRequest`s into
   `Ticket`s before deleting the note path, so nothing in-flight is orphaned.
