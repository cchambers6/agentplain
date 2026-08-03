# docs/reviews

This directory holds independent architectural reviews — one file per pull
request that touched load-bearing surface. Each file is written by a reviewing
session that did not build the change, and is committed to the branch it
reviews. CI (`.github/workflows/fable-review-gate.yml`) reads the file, checks
its frontmatter and rubric, and blocks the merge if the review is missing,
incomplete, stale, or carries a `fail` verdict. Nothing else belongs here — this
is a review record, not a design-doc directory.

Name the file `<yyyy-mm-dd>-<branch-slug>.md`: the date the review was written,
then the branch with every non-alphanumeric run collapsed to a hyphen — for
example `2026-08-01-fable-prereview-gate-2026-08-01.md`. `TEMPLATE.md` and this
`README.md` are the only files here that are not review records, and the gate
excludes both by name. If gated changes land after a review, do not edit history
— write a second, dated review that points at the new commit.

Start from [`TEMPLATE.md`](./TEMPLATE.md): copy it, fill every section, and keep
sections that do not apply with one sentence explaining why. The norm itself —
which PR classes trigger the gate, how a build agent requests a review, the
staleness rule, and the Conner-only override label — lives in
[`docs/engineering/pre-merge-review-gate.md`](../engineering/pre-merge-review-gate.md).
