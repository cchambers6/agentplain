# What Design needs from the other heads

Ordered by deadline. Everything here is blocking or materially degrading the Monday-send conversion path; nothing is a nice-to-have.

---

## From Engineering

1. **Land PR #355 (send-path wave) before Monday 2026-07-06.** It contains the `/how-it-works` unshadow (deleting `next.config.mjs:22-25`) and the `NEXT_PUBLIC_BOOKING_URL` CTA + `/contact`. This is the single highest-leverage merge for the broker path; Design will not rebuild what's sitting in an open PR. If #355 can't land whole, cherry-pick the redirect deletion — it's the P0.
2. **Merge window for the Day-1 design fixes.** Two small PRs will follow this one: (a) `.btn-confident`/`.btn-primary` `text-white` contrast fix + `/guarantee` linkage + sitemap entry; (b) root `app/not-found.tsx`. Both are additive; I need same-day review turnaround Fri/Sat.
3. **Promote brand-gate + voice-gate to blocking CI** (kaizen improvement 2). Both gates are pre-push only; `HUSKY=0` pushes and GitHub-web merges bypass them. Every design guarantee in these documents is only as strong as its gate. A `brand-gates.yml` workflow running both on every PR closes it. Include the model-vendor-name CI check recommended in `feedback_model_vendor_invisible_on_customer_surfaces` while you're in there — same workflow, one grep rule.
4. **Widen the gate scan scope** (kaizen friction 1): `lib/reports/weekly-report-email.ts`, `lib/billing/dunning.ts`, `app/global-error.tsx` still carry the pre-heritage palette because `buildSurfaceFiles()` never looks there. The dunning email — a money moment — is off-brand today. Glob the email generators; kill the hardcoded 6-file list.

## From Product

1. **Demo mode ON by default for fresh real-estate trial workspaces** until the first real handoff exists. The `demoStory` seam and the killer-workflow runtime already exist (PR #303); this is a default-flip decision, not a build. Design contract: a Monday-send broker who starts a trial never sees an empty first render. Synthetic data stays clearly labeled as it is today.
2. **Accept the shell P1 batch as next-sprint work:** `loading.tsx` for Connections + Reports hubs (copy supplied in audit 03), `settings/page.tsx:46` silent-null → `notFound()`, and the 44px touch-target bump on button primitives. I'll pair on the button primitive change since it's a `globals.css` edit with estate-wide inheritance.
3. **A ruling on the `/how-it-works` closing CTA:** booked call (my recommendation — matches the CEO lever) vs. trial signup. One target, not both side-by-side; two co-equal CTAs at the conviction peak split the click.

## From Marketing

1. **Decide the email link destination by Friday EOD: I recommend `/real-estate`, not the home page.** It's one of the 5 verticals with top-tier #312 assets, speaks the broker's vocabulary from the first line, and skips one hop. The home page serves the ten-vertical story; a GA broker needs the one-vertical story. If you disagree, say so Friday so the first-impression pass targets the right page.
2. **Substantiate or surrender the `$2,900–$10,600/mo` range** (`lib/marketing/home-content.ts`). Options: (a) publish a derivation I can cite in a source comment, (b) fall back to the calculator's labeled default (~$4,300/mo), (c) cut the numbers and let the interactive calculator carry it. I need the ruling by Monday; the card currently violates the Truth-Wave standard on the exact surface the sends will hit.
3. **One-clause justification for the strikethrough pricing** ($199→$99, $299→$199) for `/pricing` — truthful, dated if possible. Unexplained discounts read as fake urgency to exactly this buyer.
4. **Confirm `NEXT_PUBLIC_BOOKING_URL` has a value** (Conner action from the send-path wave: Calendly link). A booking CTA that renders without a target is worse than no CTA. Design will not ship the CTA styling until the env value is confirmed in production.

## From Conner (via whoever owns the queue)

1. The **counsel packet** for privacy/terms/aup/security remains open (audit 01 finding 6) — not design work, but the `/security` page naming Conner as sole prod-access holder (finding 2) is a one-line redaction I'd fold into the Day-1 fix PR with his nod.
