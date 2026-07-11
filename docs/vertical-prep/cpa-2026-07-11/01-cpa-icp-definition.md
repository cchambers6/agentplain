# 01 — CPA ICP definition (Georgia, prep-only)

**Lineage:** expands the ratified CPA section of `docs/sales/deep-dive-2026-07-02/01-named-icp-per-vertical.md` to the same depth the RE beachhead got. Where the two disagree, the deep-dive's sequencing rules win; this file only adds specificity.

## The ICP, one paragraph

The managing partner of an independent Georgia CPA or tax-and-advisory firm with roughly **5–15 professional headcount** (the deep-dive's floor was 2; we raise it for the first cohort the same way RE learned to — below ~5 seats the drafting load rarely covers the value story, and the case study won't generalize). The partner still personally carries the coordination load: chasing missing client documents at month-end and through the season's eight-week crunch, drafting client status and follow-up emails after hours, and running the firm's own books in QuickBooks Online. They carry preparer-penalty exposure personally — IRC §6694 runs $1,000–$5,000 per return against the preparer, and Circular 230 discipline attaches to the individual — which makes the approval gate the pitch, not a caveat. Tax + client advisory focus, not audit-dominant: assurance work shrinks our usable surface (independence rules, workpaper stacks we don't touch) and lengthens procurement. Georgia first, metro Atlanta suburbs especially — the same referral geography the RE beachhead is building, and closing attorneys + brokers know their CPAs.

## Firmographic filters

- Independent local/regional firm — not top-200, not a franchise (H&R Block, Padgett, Liberty), not a Big-4 feeder
- 5–15 professional staff (CPAs + preparers + client-services + admin); managing partner active in the practice, not an absentee owner
- Tax + advisory / client-accounting-services mix; bookkeeping retainers a plus (recurring monthly touch = recurring draft-shaped work)
- QuickBooks Online-centric practice (firm's own books at minimum; QBO write-up work for clients is the strong signal)
- Gmail or Microsoft 365 (hard requirement — every live workflow reads the inbox/calendar)
- Stack signals as *ops-maturity indicators only, never integration promises*: TaxDome, Karbon, Canopy, Drake, Lacerte, UltraTax. None is claimed in outreach — the honest integration story is **email + calendar + QuickBooks Online + DocuSign + Drive/OneDrive** (claims spine; `lib/verticals/cpa/content.ts` integrations block)
- Community signals: GSCPA membership or chapter activity, AICPA/PCPS engagement, chamber visibility, a client-facing newsletter or portal (signals comfort with client-facing tooling)

## Three disqualifiers

1. **Practice management lives in TaxDome or Karbon and they expect us to read it on day one.** Both connect tiles are honestly `coming-soon` (`lib/integrations/marketplace.ts` — the read layer exists, the paste-your-key connect step doesn't). If their week can't be reached through email + QBO + OneDrive while the connect forms ship, it's an honest not-yet with a named revisit condition, logged, not a stretch.
2. **Tax-season compression.** No first touch or onboarding between January 15 and April 15, soft hold mid-September to October 15. A firm that says "call me after the 15th" gets a dated CRM row, not a workaround.
3. **Audit-practice-dominant firms.** Independence rules and engagement-workpaper systems (CaseWare, CCH ProSystem fx) make our live surface area tiny, and their procurement gates (security review, SOC 2) are ones we can't clear yet — the same park-politely rule the RE ICP applies to SOC 2 shops.

## Would-be-a-yes profile

*"Alpharetta firm, 7 seats: managing partner, 2 CPAs, 2 preparers, a client-services manager, an admin. Month-end close and the season each turn the partner into a chase machine — 40 missing-doc emails written personally, one at a time. Firm books and most client write-up work in QuickBooks Online; engagement letters and 8879s through DocuSign; the office lives in Outlook. She publishes a quarterly client newsletter and is active in her GSCPA chapter. She wants the drafting off her plate and needs the approval gate to satisfy her own Circular 230 posture — nothing reaches a client or the IRS without her sign-off, which is exactly the architecture."*

## List source

Georgia Society of CPAs directory + Georgia State Board of Accountancy license rolls give the free census; Apollo enriches the shortlist (email, LinkedIn) — same rosters-first, enrich-second pattern the RE list used. The warm column outranks everything: Conner's RE design partners and the FlatSBO-adjacent closing-attorney network all *have* CPAs, and by activation day the RE lane will have live partners who can be asked, plainly, "who does your firm's taxes?"

## Offer + terms (locked elsewhere, restated for one-glance use)

- Design-partner offer: **three months free, weekly 30-min founder call, co-authored case study approved word by word, on-record testimonial only after real value.** Five slots across all verticals; the count that's true at send time is the only count used.
- Recommended tier at conversion: **Partner** ($299/seat solo, sliding to $199) — the weekly-cadence tier fits tax-season rhythm (`lib/verticals/cpa/content.ts` pricing note).
- Trial mechanics if a non-design-partner arrives: 14-day trial (CPA extended trial, `lib/billing/facts.ts`), card at signup, 14-day money-back guarantee.
