# ToS / Privacy updates required before the first partner signs

Date: 2026-07-03. Scope: the published `/terms`, `/privacy`, `/aup`, `/security`
pages and their source of record (`docs/legal/tos-2026-06-17.md`). Each item states
the change, why, who applies it, and whether it blocks signature. "Blocks
signature" means: the design-partner short-form (doc 02) incorporates the ToS and
Privacy Policy by reference, so a partner signing the short-form is warranting
reliance on these documents as published.

## Blocking — resolve before a partner signs

**1. Party identity placeholders, honestly handled.**
The ToS source names no legal entity (kaizen friction #1). Until Conner's entity
decision closes: do NOT invent an entity string. If a signature precedes
formation, the short-form signs as disclosed sole proprietor per counsel's advice
(packet item 1.4), and the ToS "who we are" language stays silent rather than
false. The day the entity exists: fill party name + notice address in ToS,
Privacy, and the CAN-SPAM postal footer seam in one PR.
*Owner: Conner (decision) → legal (fill). Blocks: signature on entity paper only.*

**2. Data-rights drift: support tickets.**
`lib/storage/data-categories.ts:174` promises support tickets are "removed on
account close"; audit 10/10 (PR #330) found they survive close. Pick one direction
this week: (a) Engineering wires the deletion path and the invariant test into CI,
or (b) the published right is softened to what the runtime does ("retained for
support-quality purposes for up to N days after closure"). Signing while the
published right exceeds tested behavior is warranting an untruth — the exact
failure mode prelaunch-review item A11 warns about.
*Owner: Product/Eng choice (doc 05). Blocks: yes.*

**3. /security absolutes — apply the ratified softening.**
`docs/copy-rulings/2026-07-03/security-page.md` (PR #354) already contains the
exact replacement text: the 24-hour containment absolute becomes
"work to contain… as quickly as possible," the 72-hour notification becomes an
aim, and the personal-name reference becomes "founding team." No new drafting —
apply the ruling verbatim to `app/(marketing)/security/page.tsx`. Also per the
ruling: verify Neon PITR is actually enabled before the backup claim stays live.
*Owner: Marketing/Eng apply (doc 05). Blocks: yes — prospects read /security the
week of the send, and the short-form references the site.*

**4. No fabricated compliance claims — standing rule restated.**
Nothing on any customer surface may claim SOC 2, HIPAA, ISO, penetration-tested,
or "compliant with X" status that no artifact substantiates (KILL #7 forbids
funding the hardening that would make such claims true). Today's pages pass after
item 3 lands; this item exists so it stays true: any PR adding a compliance
noun to a customer surface needs a citation in the PR body.
*Owner: legal (review rule). Blocks: continuously.*

**5. Model-vendor invisibility in the legal docs.**
Per the ratified ruling (PR #354): the model vendor may be named **only** in the
`/privacy` and `/security` subprocessor lists — never in ToS/AUP value or
capability language. The AUP's "downstream of our model provider's usage policy"
framing should reference "our AI model providers" generically with a pointer to
the subprocessor list. Verify no other legal-page occurrence exists after the
7-item marketing scrub (also PR #354) is applied.
*Owner: legal verify after marketing scrub. Blocks: yes (cheap).*

## Required, but can trail signature by days

**6. Resolve the four `[COUNSEL]` flags in the ToS source** — framed as decisions
(packet item 1.2):
- §1.2 data residency: confirm the statement matches actual Neon/Vercel regions.
- §2 reverse-engineering carve-out: confirm interoperability carve-out language.
- §4 suspension: decide the soft-suspend → hard-suspend escalation timeline.
- Overall bless of the IP/data-ownership additions.

**7. Draft-only autonomy scope stated plainly in the ToS.**
The ToS should say what the short-form §1 says: the service drafts; the customer
sends; no unattended execution. This is the company's best liability clause and
its best marketing claim — they should be the same sentence.

**8. Two-bucket data language, exactly per the ratified positioning.**
Privacy Policy describes: (a) assistant memory persists for the life of the
account and is deleted on closure — a feature, stated as one; (b) raw connected-
tool data is processed pass-through, never copied to long-term storage. BANNED
phrasings (ratified 2026-06-18): "we store nothing," "forgets everything."
Verify the invariant test (`lib/storage/data-categories.ts` scan of
`schema.prisma`) is green and wired into CI (audit 10 found it wired into no
workflow — doc 05, Engineering ask #3).

**9. ToS versioning + "last updated" discipline.**
Clickwrap (prelaunch A4) needs a version id to log against. Add a visible version
and date to `/terms` now so the eng clickwrap work (doc 05) has a stable anchor;
the acceptance record stores {user, version, timestamp}.

**10. Design-partner precedence clause.**
One sentence in the ToS: "If you have signed a separate written agreement with us,
that agreement controls where it conflicts with these terms." The short-form §11
asserts precedence; the ToS should not contradict it.

## Explicitly NOT in this update (and why)

- **DPA:** blocked three ways (kaizen friction #4); doc 06 forbids signing one
  before the portal RLS/deletion fixes. Design partners are direct customers
  signing the short-form; no DPA is required for the pilot cohort. If a partner's
  counsel requests one, that request escalates to Batch 3.1 — we do not improvise.
- **Per-vertical annexes (CPA §7216, law UPL, PM tenant-PII):** doc 06 — no new
  terms drafting for non-RE verticals until two RE pilots are live.
- **Arbitration/venue overhaul:** counsel decision, not fleet drafting.
