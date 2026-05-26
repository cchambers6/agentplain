// git credential-helper implementing the `get` protocol for the
// agentplain-fleet GitHub App.
//
// USAGE
//   git invokes this script as `credential.helper "!node --import tsx <this>"`.
//   On `get`, it reads protocol/host/path on stdin (key=value lines, blank
//   line terminator) and — only for github.com under the cchambers6 owner —
//   mints a fresh ~1h installation token via lib/github/app-auth.ts and prints
//   `username=x-access-token\npassword=<token>\n` to stdout. For any other
//   host/owner/action it emits nothing, so git falls through to whatever else
//   is configured (or prompts) and we cannot leak the App token off-target.
//
// SECURITY
//   - The private key is read from `AGENTPLAIN_FLEET_PEM_PATH`, defaulting to
//     C:\private\agentplain-fleet.2026-05-14.private-key (2).pem on the desktop
//     runtime. The PEM never leaves memory; nothing is written to disk; the
//     token is only emitted as `password=...` to git's stdin pipe (not stdout
//     of any other process, not echoed, not logged).
//   - This grants the App's scoped permissions (Contents/PR/Workflows write on
//     @cchambers6 only). See docs/git-auth.md §Security.
//   - Owner gate is strict equality on the first path segment. Anything not
//     under cchambers6/* gets no token, no error, no signal.
//
// TESTABILITY
//   `runCredentialHelper` is exported and accepts injectable `stdin` + `mint`,
//   so the smoke test exercises the protocol without the real PEM. The default
//   `mint` builds GitHubAppAuth with the hardcoded App ID 3714103 +
//   installation 132417507 (the agentplain-fleet App on @cchambers6 — confirmed
//   in the fleet token-mint flow described in the P0-3 brief) and the PEM
//   resolved from env.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { GitHubAppAuth, type InstallationToken } from '../../lib/github/app-auth'

/** Numeric App ID for the agentplain-fleet GitHub App. */
export const AGENTPLAIN_FLEET_APP_ID = '3714103'
/** Installation id of agentplain-fleet on the @cchambers6 owner. */
export const AGENTPLAIN_FLEET_INSTALLATION_ID = 132417507
/** Owner this helper services. Anything else gets a silent no-op. */
export const AGENTPLAIN_FLEET_OWNER = 'cchambers6'
/** Default PEM path on the desktop runtime. */
export const DEFAULT_PEM_PATH = 'C:\\private\\agentplain-fleet.2026-05-14.private-key (2).pem'

export interface CredentialHelperInput {
  /** First positional arg from git: 'get', 'store', or 'erase'. */
  action: string
  /** Raw stdin contents (key=value\n lines terminated by a blank line). */
  stdin: string
}

export interface CredentialHelperDeps {
  /** Injected token minter; default mints via real GitHub App. */
  mint?: () => Promise<Pick<InstallationToken, 'token'>>
}

interface ParsedCredentialInput {
  protocol?: string
  host?: string
  path?: string
}

/**
 * Parse the git credential-helper stdin format:
 *
 *     protocol=https
 *     host=github.com
 *     path=cchambers6/agentplain.git
 *     [blank line]
 *
 * Unknown keys are tolerated (forward-compatible with future git versions).
 */
function parseCredentialInput(stdin: string): ParsedCredentialInput {
  const out: ParsedCredentialInput = {}
  for (const rawLine of stdin.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line.length === 0) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq)
    const value = line.slice(eq + 1)
    if (key === 'protocol' || key === 'host' || key === 'path') {
      out[key] = value
    }
  }
  return out
}

/**
 * Owner gate: only fire for github.com under cchambers6/*.
 * The path field is present only when `credential.useHttpPath` is on
 * (setup-fleet-credential-helper sets this). If path is absent, we no-op —
 * safer to fall through to git's prompt than to mint a token without
 * confirming the owner.
 */
function shouldMint(input: ParsedCredentialInput): boolean {
  if (input.host !== 'github.com') return false
  if (input.protocol && input.protocol !== 'https') return false
  if (!input.path) return false
  // path is `cchambers6/agentplain.git` or similar — first segment is owner.
  const firstSegment = input.path.split('/')[0]
  return firstSegment.toLowerCase() === AGENTPLAIN_FLEET_OWNER.toLowerCase()
}

/**
 * Default minter: read PEM from env-resolved path and mint via the App
 * installation flow.
 */
function defaultMint(): () => Promise<Pick<InstallationToken, 'token'>> {
  return async () => {
    const pemPath = process.env.AGENTPLAIN_FLEET_PEM_PATH || DEFAULT_PEM_PATH
    let privateKeyPem: string
    try {
      privateKeyPem = readFileSync(pemPath, 'utf8')
    } catch (cause) {
      throw new Error(
        `agentplain-fleet credential helper: PEM not readable at ${pemPath}. ` +
          `Set AGENTPLAIN_FLEET_PEM_PATH or restore the file. (cause: ${(cause as Error).message})`,
      )
    }
    const auth = new GitHubAppAuth({
      appId: AGENTPLAIN_FLEET_APP_ID,
      privateKeyPem,
      installationId: AGENTPLAIN_FLEET_INSTALLATION_ID,
    })
    const minted = await auth.mintInstallationToken()
    return { token: minted.token }
  }
}

/**
 * Pure core of the credential helper. Returns the stdout body git will read;
 * an empty string means "no credential" and git falls through.
 *
 * Throws only when the action is `get` and minting fails — git surfaces stderr
 * to the operator so they know to fix the env. For non-`get` actions or
 * off-target hosts/owners, returns '' silently.
 */
export async function runCredentialHelper(
  input: CredentialHelperInput,
  deps: CredentialHelperDeps = {},
): Promise<string> {
  if (input.action !== 'get') return ''
  const parsed = parseCredentialInput(input.stdin)
  if (!shouldMint(parsed)) return ''
  const mint = deps.mint ?? defaultMint()
  const { token } = await mint()
  return `username=x-access-token\npassword=${token}\n`
}

async function main(): Promise<void> {
  const action = process.argv[2] ?? ''
  let stdin = ''
  if (!process.stdin.isTTY) {
    process.stdin.setEncoding('utf8')
    for await (const chunk of process.stdin) stdin += chunk
  }
  try {
    const out = await runCredentialHelper({ action, stdin })
    if (out.length > 0) process.stdout.write(out)
  } catch (err) {
    // Never echo the token, JWT, or PEM contents. The AppAuthError already
    // strips secrets out of its message; pass the message through verbatim.
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`agentplain-fleet credential helper: ${message}\n`)
    process.exit(1)
  }
}

// Run main() only when invoked as a CLI — not when the test imports
// `runCredentialHelper`. `pathToFileURL` handles Windows path quirks.
const isMain = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? '').href
  } catch {
    return false
  }
})()
if (isMain) {
  void main()
}
