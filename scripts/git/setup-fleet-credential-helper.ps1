# Register the agentplain-fleet GitHub App credential helper for the current
# Windows user. Idempotent — safe to re-run.
#
# What it does:
#   1. Enables `credential.useHttpPath` for github.com so git includes the
#      request path in credential lookups (the helper uses the path's first
#      segment to verify the owner).
#   2. Resets the credential.helper chain at the github.com/cchambers6 URL
#      scope (clears inherited helpers like manager-core for these URLs).
#   3. Installs `!node --import tsx <repo>/scripts/git/agentplain-fleet-credential-helper.ts`
#      as the only helper at that URL scope.
#
# After this runs, `git push` to https://github.com/cchambers6/<repo> works
# with no manual token mint — git invokes the helper, which mints a fresh
# ~1h installation token from the App private key on each push.
#
# Run once per machine / per fresh code session:
#   pwsh scripts/git/setup-fleet-credential-helper.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$HelperPath = (Join-Path $RepoDir "scripts/git/agentplain-fleet-credential-helper.ts").Replace('\', '/')

if (-not (Test-Path $HelperPath)) {
  Write-Error "Helper script not found at $HelperPath"
  exit 1
}

$Cmd = "!node --import tsx '$HelperPath'"

# Path-aware lookup so the helper sees `path=cchambers6/...` on stdin.
git config --global credential.https://github.com.useHttpPath true

# Reset accumulated helpers at the cchambers6 URL scope, then install ours.
# The empty-string entry tells git to clear the accumulated helper list
# for this URL scope before our entry is added.
git config --global --replace-all credential.https://github.com/cchambers6.helper ""
git config --global --add credential.https://github.com/cchambers6.helper $Cmd

Write-Host ""
Write-Host "✅ agentplain-fleet credential helper installed (global, current user)."
Write-Host "   Scope     : https://github.com/cchambers6/*"
Write-Host "   Helper    : $Cmd"
Write-Host "   PEM env   : AGENTPLAIN_FLEET_PEM_PATH"
Write-Host "                 (default: C:\private\agentplain-fleet.2026-05-14.private-key (2).pem)"
Write-Host ""
Write-Host "Verify with:"
Write-Host "  git config --global --get-regexp '^credential\.'"
Write-Host ""
Write-Host "Security: this grants the App's scoped permissions to any local git"
Write-Host "operation under cchambers6/*. Intended for the fleet's own machine."
Write-Host "See docs/git-auth.md for details."
