# Move plan: `agentplain/chiron/` → `cchambers6/chiron`

This app lives in the agentplain monorepo as an interim measure. The fleet
token got HTTP 403 on `POST /user/repos` (the GitHub App installation has no
user-scoped repo-creation permission), so the scaffold landed here instead of
in a dedicated repo.

## What Conner needs to do (2 minutes)

1. Create the empty **private** repo `cchambers6/chiron` on GitHub
   (no README, no .gitignore — completely empty).
2. Extend the fleet GitHub App installation to cover the new repo
   (GitHub → Settings → Applications → the fleet app → Repository access).

## What the follow-up session then does

1. `git clone` the new repo, copy over:
   - `chiron/**` → repo root (drop this file)
   - `docs/research/2026-07-10-classical-curricula/`, `docs/research/philosophies/`,
     `docs/research/compliance/` → `docs/research/` in the new repo
2. Update `chiron/scripts/build-catalog.mjs` path resolution — it already
   handles both layouts (monorepo `../../docs` and dedicated `../docs`).
3. Copy the fleet credential-helper pattern (`.get-token.mjs` +
   `scripts/git/fleet-credential-helper.ts`) with the new repo path.
4. Open the initial PR against the new repo's `main`; delete `chiron/` and the
   research tree from agentplain in the same sweep (one PR here, one there).

Nothing in the app assumes the monorepo beyond the catalog-build path in
step 2, which is already dual-layout.
