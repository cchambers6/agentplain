// GitHub App installation-token minter — the credential the fleet uses to push
// its own output back to the repo autonomously, and the engine behind the git
// credential helper at scripts/git/agentplain-fleet-credential-helper.ts.
//
// WHY THIS EXISTS
//   Before this adapter, the only push credential available to the fleet was a
//   hand-minted PAT or a manually-pasted x-access-token URL — friction that
//   surfaced as P0-3 in docs/fleet-architecture.md. This adapter mints a
//   short-lived (~1h) installation token from the agentplain-fleet GitHub App
//   private key, giving any caller (cron, credential helper, ad-hoc script)
//   the App's scoped permissions (Contents/PR/Workflows write on @cchambers6).
//
// PORTABILITY (project_living_portable_architecture / feedback_no_silent_vendor_lock)
//   `ForgeAppAuth` is the vendor-neutral interface. `GitHubAppAuth` is the only
//   implementation today. A future forge (GitLab, Gitea) gets its own class +
//   factory; calling code depends on the interface, never on this file's GitHub
//   specifics. Same shape as `IPullRequestAdapter` over in flatsbo.
//
// SECURITY
//   The private key is read from env (`FLEET_GH_APP_PRIVATE_KEY`, the PEM body —
//   used on CI) or a file path (`FLEET_GH_APP_PRIVATE_KEY_PATH` — used on the
//   desktop runtime where the .pem lives at C:\private\...). The credential
//   helper additionally honours `AGENTPLAIN_FLEET_PEM_PATH` and constructs the
//   adapter directly with the PEM body. The key and the minted token are NEVER
//   logged, returned in errors, or written to disk.

import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'

const GITHUB_API_BASE = 'https://api.github.com'

export interface InstallationToken {
  /** Short-lived installation access token (treat as a secret). */
  token: string
  /** ISO-8601 expiry (≈1h out). */
  expiresAt: string
  installationId: number
  /** Permissions granted to this token, as reported by GitHub. */
  permissions: Record<string, string>
}

export class AppAuthError extends Error {
  readonly status?: number
  readonly providerCode?: string
  constructor(message: string, opts: { status?: number; providerCode?: string; cause?: unknown } = {}) {
    super(message)
    this.name = 'AppAuthError'
    this.status = opts.status
    this.providerCode = opts.providerCode
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause
  }
}

/** Vendor-neutral interface — see PORTABILITY note above. */
export interface ForgeAppAuth {
  mintInstallationToken(): Promise<InstallationToken>
}

interface GitHubFetch {
  (input: string, init?: RequestInit): Promise<Response>
}

export interface GitHubAppAuthConfig {
  /** Numeric App ID (not the client id). */
  appId: string
  /** PEM-encoded RSA private key contents. */
  privateKeyPem: string
  /**
   * Installation id to mint against. Optional — when absent the adapter
   * discovers it via `GET /app/installations` (uses the first installation,
   * or the one whose account login matches `accountLogin` if provided).
   */
  installationId?: number
  /** Disambiguates discovery when the App is installed on multiple accounts. */
  accountLogin?: string
  apiBase?: string
  fetchImpl?: GitHubFetch
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export class GitHubAppAuth implements ForgeAppAuth {
  private readonly appId: string
  private readonly privateKeyPem: string
  private readonly explicitInstallationId?: number
  private readonly accountLogin?: string
  private readonly apiBase: string
  private readonly fetchImpl: GitHubFetch

  constructor(config: GitHubAppAuthConfig) {
    if (!config.appId) throw new AppAuthError('appId is required')
    if (!config.privateKeyPem || !config.privateKeyPem.includes('PRIVATE KEY')) {
      throw new AppAuthError('privateKeyPem is required and must be a PEM-encoded RSA key')
    }
    this.appId = config.appId
    this.privateKeyPem = config.privateKeyPem
    this.explicitInstallationId = config.installationId
    this.accountLogin = config.accountLogin
    this.apiBase = config.apiBase ?? GITHUB_API_BASE
    this.fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init))
  }

  /** RS256-signed app JWT, valid 9 minutes (GitHub caps at 10). */
  private appJwt(): string {
    const now = Math.floor(Date.now() / 1000)
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    // iat backdated 60s to tolerate clock skew between runner and GitHub.
    const payload = base64Url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: this.appId }))
    const signingInput = `${header}.${payload}`
    let signature: Buffer
    try {
      const signer = crypto.createSign('RSA-SHA256')
      signer.update(signingInput)
      signature = signer.sign(this.privateKeyPem)
    } catch (cause) {
      throw new AppAuthError('Failed to sign app JWT — private key invalid?', { cause })
    }
    return `${signingInput}.${base64Url(signature)}`
  }

  private async ghJson<T>(url: string, jwt: string, init: RequestInit = {}): Promise<T> {
    let res: Response
    try {
      res = await this.fetchImpl(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'agentplain-fleet-app-auth',
          ...(init.headers ?? {}),
        },
      })
    } catch (cause) {
      throw new AppAuthError(`Network error calling ${url}`, { cause })
    }
    const text = await res.text()
    if (!res.ok) {
      let providerCode: string | undefined
      try {
        providerCode = (JSON.parse(text) as { message?: string }).message
      } catch {
        providerCode = undefined
      }
      // Never echo the JWT or token; surface status + GitHub's message only.
      throw new AppAuthError(`GitHub returned ${res.status} for ${new URL(url).pathname}: ${providerCode ?? ''}`, {
        status: res.status,
        providerCode,
      })
    }
    return JSON.parse(text) as T
  }

  private async resolveInstallationId(jwt: string): Promise<number> {
    if (this.explicitInstallationId) return this.explicitInstallationId
    const installs = await this.ghJson<Array<{ id: number; account?: { login?: string } }>>(
      `${this.apiBase}/app/installations`,
      jwt,
    )
    if (!Array.isArray(installs) || installs.length === 0) {
      throw new AppAuthError('App has no installations')
    }
    if (this.accountLogin) {
      const match = installs.find((i) => i.account?.login?.toLowerCase() === this.accountLogin!.toLowerCase())
      if (!match) throw new AppAuthError(`No installation found for account "${this.accountLogin}"`)
      return match.id
    }
    return installs[0].id
  }

  async mintInstallationToken(): Promise<InstallationToken> {
    const jwt = this.appJwt()
    const installationId = await this.resolveInstallationId(jwt)
    const result = await this.ghJson<{ token: string; expires_at: string; permissions?: Record<string, string> }>(
      `${this.apiBase}/app/installations/${installationId}/access_tokens`,
      jwt,
      { method: 'POST' },
    )
    if (!result.token) throw new AppAuthError('access_tokens response missing token')
    return {
      token: result.token,
      expiresAt: result.expires_at,
      installationId,
      permissions: result.permissions ?? {},
    }
  }
}

/**
 * Build an x-access-token remote URL for git push. The token is embedded in the
 * URL — callers must NOT log the result. Use only as the `git push <url>` arg.
 *
 * Prefer the credential-helper path (scripts/git/agentplain-fleet-credential-helper.ts)
 * for normal pushes; this helper exists for scripts that manage their own remote.
 */
export function authenticatedRemoteUrl(owner: string, repo: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
}

/**
 * Resolve the private key from env: PEM body (`FLEET_GH_APP_PRIVATE_KEY`,
 * preferred on CI) or a file path (`FLEET_GH_APP_PRIVATE_KEY_PATH`, the desktop
 * .pem). Returns null when neither is configured so callers can fall back to a
 * different credential (e.g. `GITHUB_TOKEN`) instead of throwing.
 */
function resolvePrivateKeyFromEnv(): string | null {
  const inline = process.env.FLEET_GH_APP_PRIVATE_KEY
  if (inline && inline.includes('PRIVATE KEY')) return inline
  const keyPath = process.env.FLEET_GH_APP_PRIVATE_KEY_PATH
  if (keyPath) {
    try {
      return readFileSync(keyPath, 'utf8')
    } catch (cause) {
      throw new AppAuthError(`FLEET_GH_APP_PRIVATE_KEY_PATH set but unreadable: ${keyPath}`, { cause })
    }
  }
  return null
}

/**
 * Factory: construct the App-auth adapter from environment, or return null when
 * the App is not configured (so the caller can fall back to `GITHUB_TOKEN`).
 *
 * Env:
 *   FLEET_GH_APP_ID                  — App ID (required to use the App path)
 *   FLEET_GH_APP_PRIVATE_KEY         — PEM body (CI secret), OR
 *   FLEET_GH_APP_PRIVATE_KEY_PATH    — path to the .pem (desktop)
 *   FLEET_GH_APP_INSTALLATION_ID     — optional; discovered if absent
 *   FLEET_GH_APP_ACCOUNT             — optional; disambiguates discovery
 */
export function getForgeAppAuthFromEnv(overrides: Partial<GitHubAppAuthConfig> = {}): ForgeAppAuth | null {
  const appId = overrides.appId ?? process.env.FLEET_GH_APP_ID
  if (!appId) return null
  const privateKeyPem = overrides.privateKeyPem ?? resolvePrivateKeyFromEnv()
  if (!privateKeyPem) return null
  const installEnv = process.env.FLEET_GH_APP_INSTALLATION_ID
  const installationId =
    overrides.installationId ?? (installEnv ? Number(installEnv) : undefined)
  return new GitHubAppAuth({
    appId,
    privateKeyPem,
    installationId,
    accountLogin: overrides.accountLogin ?? process.env.FLEET_GH_APP_ACCOUNT,
    apiBase: overrides.apiBase,
    fetchImpl: overrides.fetchImpl,
  })
}
