/**
 * GitHub Actions Variables adapter.
 *
 * Implements the repo-variable surface of `OpsControlPlane`. Inngest
 * methods on this class are intentionally absent — composition is the
 * caller's job (see scripts/ops/throttle.ts for how the CLI wires GH +
 * Inngest adapters together behind a single `OpsControlPlane` instance).
 *
 * REST endpoints used (stable; documented at https://docs.github.com/en/rest/actions/variables):
 *   GET   /repos/{owner}/{repo}/actions/variables/{name}
 *   PATCH /repos/{owner}/{repo}/actions/variables/{name}
 *   POST  /repos/{owner}/{repo}/actions/variables
 *
 * Auth: PAT or fine-grained token with the `Variables: read & write`
 * permission. Set via env (`GH_PAT` preferred, `GITHUB_TOKEN` fallback).
 * Per `feedback_no_prod_secrets_in_dev`: the token used in `.env.local`
 * MUST be a dev-tier PAT scoped to non-production repos. Production
 * value lives in Vercel env, Production tier only.
 */

import type {
  InngestFunctionStatus,
  OpsControlPlane,
  OpsError,
  OpsResult,
  RepoVariable,
} from '../types'
import { opsError, opsOk } from '../types'

export interface GithubActionsVarsConfig {
  owner: string
  repo: string
  /** Optional explicit token; falls back to `GH_PAT` then `GITHUB_TOKEN`. */
  token?: string
  /** Override for testing; defaults to https://api.github.com */
  apiBase?: string
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch
}

const GITHUB_API_VERSION = '2022-11-28'
const DEFAULT_API_BASE = 'https://api.github.com'

export class GithubActionsVarsAdapter implements OpsControlPlane {
  private readonly owner: string
  private readonly repo: string
  private readonly apiBase: string
  private readonly fetchImpl: typeof fetch
  private readonly token: string

  constructor(config: GithubActionsVarsConfig) {
    if (!config.owner || !config.repo) {
      throw new Error('GithubActionsVarsAdapter: owner and repo are required')
    }
    const token = config.token ?? process.env.GH_PAT ?? process.env.GITHUB_TOKEN
    if (!token) {
      throw new Error(
        'GithubActionsVarsAdapter: missing token. Set GH_PAT (preferred) or GITHUB_TOKEN, or pass `token` in config.',
      )
    }
    this.owner = config.owner
    this.repo = config.repo
    this.apiBase = config.apiBase ?? DEFAULT_API_BASE
    this.fetchImpl = config.fetchImpl ?? fetch
    this.token = token
  }

  async getRepoVariable(key: string): Promise<OpsResult<RepoVariable>> {
    if (!isValidVariableName(key)) {
      return opsError('INVALID_ARGUMENT', `invalid variable name: ${key}`)
    }
    const url = `${this.apiBase}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/actions/variables/${encodeURIComponent(key)}`
    const res = await this.request('GET', url)
    if (!res.ok) return res
    const body = res.value
    if (!isVariableResponse(body)) {
      return opsError('MALFORMED_RESPONSE', `expected {name,value} from GitHub; got ${JSON.stringify(body).slice(0, 200)}`)
    }
    return opsOk({ name: body.name, value: body.value, updatedAt: body.updated_at })
  }

  async setRepoVariable(key: string, value: string): Promise<OpsResult<RepoVariable>> {
    if (!isValidVariableName(key)) {
      return opsError('INVALID_ARGUMENT', `invalid variable name: ${key}`)
    }
    const exists = await this.getRepoVariable(key)
    if (exists.ok) {
      const patchUrl = `${this.apiBase}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/actions/variables/${encodeURIComponent(key)}`
      const res = await this.request('PATCH', patchUrl, { name: key, value })
      if (!res.ok) return res
    } else if (exists.error.code === 'NOT_FOUND') {
      const createUrl = `${this.apiBase}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/actions/variables`
      const res = await this.request('POST', createUrl, { name: key, value })
      if (!res.ok) return res
    } else {
      return exists
    }
    return this.getRepoVariable(key)
  }

  async pauseInngestFunction(_functionId: string): Promise<OpsResult<void>> {
    return opsError(
      'NOT_IMPLEMENTED',
      'GithubActionsVarsAdapter does not control Inngest functions. Compose it with InngestControlAdapter via the CLI for cross-provider operations.',
    )
  }

  async resumeInngestFunction(_functionId: string): Promise<OpsResult<void>> {
    return opsError(
      'NOT_IMPLEMENTED',
      'GithubActionsVarsAdapter does not control Inngest functions. Compose it with InngestControlAdapter via the CLI for cross-provider operations.',
    )
  }

  async getInngestFunctionStatus(_functionId: string): Promise<OpsResult<InngestFunctionStatus>> {
    return opsError(
      'NOT_IMPLEMENTED',
      'GithubActionsVarsAdapter does not control Inngest functions. Compose it with InngestControlAdapter via the CLI for cross-provider operations.',
    )
  }

  private async request(
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    body?: unknown,
  ): Promise<OpsResult<unknown>> {
    let res: Response
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return opsError('NETWORK', `network error: ${message}`)
    }

    if (res.status === 204 || res.status === 201) return opsOk(null)
    if (res.ok) {
      const text = await res.text()
      if (text.length === 0) return opsOk(null)
      try {
        return opsOk(JSON.parse(text))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return opsError('MALFORMED_RESPONSE', `failed to parse JSON: ${message}`, { status: res.status })
      }
    }
    return mapHttpError(res)
  }
}

async function mapHttpError(res: Response): Promise<{ ok: false; error: OpsError }> {
  let detail: string | undefined
  let documentationUrl: string | undefined
  try {
    const body = (await res.json()) as { message?: string; documentation_url?: string }
    detail = body?.message
    documentationUrl = body?.documentation_url
  } catch {
    // body wasn't JSON; ignore
  }
  const baseMsg = detail ?? res.statusText ?? `HTTP ${res.status}`

  if (res.status === 404) {
    return opsError('NOT_FOUND', baseMsg, { status: 404, reference: documentationUrl })
  }
  if (res.status === 401) {
    return opsError('UNAUTHORIZED', baseMsg, { status: 401, reference: documentationUrl })
  }
  if (res.status === 403) {
    const isRateLimit =
      res.headers.get('x-ratelimit-remaining') === '0' ||
      /rate limit/i.test(detail ?? '')
    if (isRateLimit) {
      const reset = res.headers.get('x-ratelimit-reset')
      const resetMs = reset ? Math.max(0, Number(reset) * 1000 - Date.now()) : undefined
      return opsError('RATE_LIMITED', baseMsg, {
        status: 403,
        reference: documentationUrl,
        retryAfterMs: resetMs,
      })
    }
    return opsError('FORBIDDEN', baseMsg, { status: 403, reference: documentationUrl })
  }
  if (res.status === 422 || res.status === 409) {
    return opsError('CONFLICT', baseMsg, { status: res.status, reference: documentationUrl })
  }
  if (res.status >= 500) {
    return opsError('UPSTREAM_ERROR', baseMsg, { status: res.status, reference: documentationUrl })
  }
  return opsError('UPSTREAM_ERROR', baseMsg, { status: res.status, reference: documentationUrl })
}

function isValidVariableName(name: string): boolean {
  // GitHub: alphanumeric + underscore, must not start with GITHUB_ or a digit, max 200 chars.
  return /^[A-Za-z_][A-Za-z0-9_]{0,199}$/.test(name) && !/^GITHUB_/i.test(name)
}

function isVariableResponse(body: unknown): body is { name: string; value: string; updated_at?: string } {
  return (
    !!body &&
    typeof body === 'object' &&
    typeof (body as Record<string, unknown>).name === 'string' &&
    typeof (body as Record<string, unknown>).value === 'string'
  )
}
