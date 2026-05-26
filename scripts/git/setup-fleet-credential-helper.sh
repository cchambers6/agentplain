#!/usr/bin/env sh
# Register the agentplain-fleet GitHub App credential helper. Idempotent —
# safe to re-run. POSIX-shell mirror of setup-fleet-credential-helper.ps1
# (use either; they produce the same git config).
#
# After this runs, `git push` to https://github.com/cchambers6/<repo> works
# with no manual token mint — git invokes the helper, which mints a fresh
# ~1h installation token from the App private key on each push.
#
# Run once per machine / per fresh code session:
#   sh scripts/git/setup-fleet-credential-helper.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HELPER_PATH="$REPO_DIR/scripts/git/agentplain-fleet-credential-helper.ts"

if [ ! -f "$HELPER_PATH" ]; then
  echo "Helper script not found at $HELPER_PATH" >&2
  exit 1
fi

# Normalise Windows-style C:\... paths to /c/... when running under git-bash,
# so the `!`-prefixed shell command resolves on either side.
case "$HELPER_PATH" in
  /[A-Za-z]/*) ;; # already POSIX
  [A-Za-z]:*) HELPER_PATH="$(echo "$HELPER_PATH" | sed -E 's#^([A-Za-z]):#/\L\1#' | tr '\\' '/')" ;;
esac

CMD="!node --import tsx '$HELPER_PATH'"

git config --global credential.https://github.com.useHttpPath true
git config --global --replace-all credential.https://github.com/cchambers6.helper ""
git config --global --add credential.https://github.com/cchambers6.helper "$CMD"

echo ""
echo "agentplain-fleet credential helper installed (global, current user)."
echo "  Scope   : https://github.com/cchambers6/*"
echo "  Helper  : $CMD"
echo "  PEM env : AGENTPLAIN_FLEET_PEM_PATH"
echo "            (default: C:\\private\\agentplain-fleet.2026-05-14.private-key (2).pem)"
echo ""
echo "Verify:"
echo "  git config --global --get-regexp '^credential\\.'"
echo ""
echo "Security: this grants the App's scoped permissions to any local git"
echo "operation under cchambers6/*. See docs/git-auth.md."
