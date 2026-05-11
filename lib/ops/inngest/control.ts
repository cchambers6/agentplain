/**
 * Inngest control-plane adapter — Vercel-env backed.
 *
 * Implemented via the in-house flag pattern per `capability_inbox.md`
 * proposal #13. Inngest itself does not publish a public REST API for
 * pausing or resuming cron functions (verified at
 * https://www.inngest.com/docs/guides/pause-functions on 2026-05-10 —
 * pause is exclusively a Cloud-UI operation). Rather than wait for an
 * upstream API, we wrap every Inngest function in `lib/inngest/functions/*.ts`
 * with an `isFunctionDisabled()` gate (lib/inngest/disable-flag.ts). The
 * gate reads `process.env.INNGEST_FN_DISABLE_<NORMALIZED_ID>`. This
 * adapter writes that env var via the Vercel REST API.
 *
 * Why this beats waiting for Inngest:
 *   - org-ops-management owns the kill-switch, not the vendor (per
 *     `feedback_no_silent_vendor_lock` + `project_living_portable_architecture`).
 *   - The mechanism mirrors the existing `USE_GHA_CRON` repo-variable
 *     pattern — same shape, same audit log, same contract test.
 *   - If Inngest ships a real pause API tomorrow, only this file changes.
 *     The function handlers, the disable-flag helper, the throttle CLI,
 *     and the contract tests stay put.
 *
 * Vercel REST endpoints used (documented at https://vercel.com/docs/rest-api/reference/endpoints/projects):
 *   POST   /v9/projects/{id}/env?upsert=true   create-or-update single env var
 *   GET    /v9/projects/{id}/env               list all env vars (we filter by key)
 *
 * We deliberately `?upsert=true` rather than read-then-PATCH/POST so the
 * mutation is a single round-trip with idempotent semantics. Read-back
 * via `getInngestFunctionStatus` is the caller's responsibility (per
 * `feedback_verify_after_create`); the throttle CLI does it
 * automatically.
 *
 * The flag is written with `type: 'plain'` so the GET response includes
 * the literal `"true"`/`"false"` value — encrypted/sensitive types come
 * back masked, which would defeat the read-back invariant.
 */

import {
  disableFlagEnvName,
  isFunctionDisabled,
} from '../../inngest/disable-flag'
import type {
  InngestFunctionStatus,
  OpsControlPlane,
  OpsError,
  OpsResult,
  RepoVariable,
} from '../types'
import { opsError, opsOk } from '../types'

const DEFAULT_API_BASE = 'https://api.vercel.com'
const DEFAULT_TARGETS: ReadonlyArray<'production' | 'preview' | 'development'> = [
  'production',
  'preview',
  'development',
]
/** Single source for the docs URL we hand callers via `error.reference`. */
const VERCEL_ENV_DOCS = 'https://vercel.com/docs/rest-api/reference/endpoints/projects'

export interface InngestControlConfig {
  /**
   * Vercel project id (e.g. `prj_XXX`). The flag env vars live under
   * this project. Required — never default this from process.env so
   * separate FlatSBO / agentplain instances cannot accidentally cross
   * over.
   */
  vercelProjectId: string
  /**
   * Vercel API token. Falls back to `VERCEL_TOKEN` env var.
   *
   * Per `feedback_no_prod_secrets_in_dev` — this is an account-level
   * secret. In `.env.local` use a dev-tier scoped token (read-only or
   * limited project access) NOT the same value as Vercel Production. See
   * lib/ops/README.md credentials section.
   */
  vercelToken?: string
  /** Optional Vercel team scope. Pass when the project is team-owned. */
  vercelTeamId?: string
  /**
   * Inngest app id used as a label on errors / audit rows. Optional —
   * no functional role. Kept so log lines say `app=flatsbo-prod` rather
   * than the bare project id.
   */
  appId?: string
  /** Override for tests. Defaults to https://api.vercel.com. */
  apiBase?: string
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch
  /**
   * Vercel deploy targets to write the flag to. Defaults to all three
   * (production + preview + development) so a pause halts the function
   * everywhere it could fire. Override only if a caller knows it wants
   * to pause production but leave dev firing.
   */
  targets?: ReadonlyArray<'production' | 'preview' | 'development'>
}

interface VercelEnvRecord {
  id: string
  key: string
  value?: string
  type?: string
  target?: string[]
}

export class InngestControlAdapter implements OpsControlPlane {
  private readonly projectId: string
  private readonly token: string
  private readonly teamId?: string
  private readonly appId: string
  private readonly apiBase: string
  private readonly fetchImpl: typeof fetch
  private readonly targets: ReadonlyArray<'production' | 'preview' | 'development'>

  constructor(config: InngestControlConfig) {
    if (!config.vercelProjectId) {
      throw new Error('InngestControlAdapter: vercelProjectId is required')
    }
    const token = config.vercelToken ?? process.env.VERCEL_TOKEN
    if (!token) {
      throw new Error(
        'InngestControlAdapter: missing token. Set VERCEL_TOKEN or pass `vercelToken` in config.',
      )
    }
    this.projectId = config.vercelProjectId
    this.token = token
    this.teamId = config.vercelTeamId
    this.appId = config.appId ?? '(unspecified)'
    this.apiBase = config.apiBase ?? DEFAULT_API_BASE
    this.fetchImpl = config.fetchImpl ?? fetch
    this.targets = config.targets ?? DEFAULT_TARGETS
  }

  // ── Repo-variable surface — not implemented (composition signal) ─────

  async getRepoVariable(_key: string): Promise<OpsResult<RepoVariable>> {
    return opsError(
      'NOT_IMPLEMENTED',
      'InngestControlAdapter does not manage GitHub repository variables. Compose with GithubActionsVarsAdapter for that surface.',
    )
  }

  async setRepoVariable(_key: string, _value: string): Promise<OpsResult<RepoVariable>> {
    return opsError(
      'NOT_IMPLEMENTED',
      'InngestControlAdapter does not manage GitHub repository variables. Compose with GithubActionsVarsAdapter for that surface.',
    )
  }

  // ── Inngest pause/resume/status — backed by Vercel env API ───────────

  async pauseInngestFunction(functionId: string): Promise<OpsResult<void>> {
    return this.writeFlag(functionId, 'true')
  }

  async resumeInngestFunction(functionId: string): Promise<OpsResult<void>> {
    // Set explicit "false" rather than DELETE — both states observable,
    // mirrors the USE_GHA_CRON pattern, and `isFunctionDisabled` already
    // treats unset and "false" identically so this is purely about
    // having a deterministic read-back value.
    return this.writeFlag(functionId, 'false')
  }

  async getInngestFunctionStatus(
    functionId: string,
  ): Promise<OpsResult<InngestFunctionStatus>> {
    const envName = safeEnvName(functionId)
    if (!envName.ok) return envName
    const list = await this.listEnvVars()
    if (!list.ok) return list
    const record = list.value.find((e) => e.key === envName.value)
    if (!record) {
      return opsOk({ functionId, pauseState: 'active' })
    }
    const value = record.value
    if (value === 'true') return opsOk({ functionId, pauseState: 'paused' })
    if (value === 'false') return opsOk({ functionId, pauseState: 'active' })
    if (value === undefined) {
      // Vercel masks values for sensitive/encrypted vars. We always write
      // type=plain, so a missing value here means another tool wrote the
      // var with a different type — we cannot trust our reading.
      return opsOk({ functionId, pauseState: 'unknown' })
    }
    // Unrecognized value (e.g. "1", "yes") — treat as active per
    // disable-flag.ts's strict equality semantics, but surface the
    // discrepancy via 'unknown' so the operator notices.
    return opsOk({ functionId, pauseState: 'unknown' })
  }

  // ── Internal: Vercel HTTP plumbing ───────────────────────────────────

  private async writeFlag(
    functionId: string,
    value: 'true' | 'false',
  ): Promise<OpsResult<void>> {
    const envName = safeEnvName(functionId)
    if (!envName.ok) return envName

    const url = this.envCollectionUrl({ upsert: true })
    const body = {
      key: envName.value,
      value,
      type: 'plain',
      target: this.targets,
      comment: `Inngest disable flag for ${functionId} (app=${this.appId}). Managed by lib/ops/inngest/control.ts. Toggled via scripts/ops/throttle.ts.`,
    }
    const res = await this.request('POST', url, body)
    if (!res.ok) return res
    return opsOk(undefined)
  }

  private async listEnvVars(): Promise<OpsResult<VercelEnvRecord[]>> {
    const url = this.envCollectionUrl({ upsert: false })
    const res = await this.request('GET', url)
    if (!res.ok) return res
    const body = res.value as { envs?: unknown } | unknown[]
    // Vercel returns either {envs: [...]} or a bare array depending on
    // surface; tolerate both rather than gamble.
    const envs = Array.isArray(body)
      ? body
      : Array.isArray((body as { envs?: unknown })?.envs)
        ? (body as { envs: unknown[] }).envs
        : null
    if (envs === null) {
      return opsError(
        'MALFORMED_RESPONSE',
        `expected {envs: [...]} or [...] from Vercel; got ${JSON.stringify(body).slice(0, 200)}`,
      )
    }
    const records: VercelEnvRecord[] = []
    for (const e of envs) {
      if (!e || typeof e !== 'object') continue
      const rec = e as Record<string, unknown>
      if (typeof rec.id !== 'string' || typeof rec.key !== 'string') continue
      records.push({
        id: rec.id,
        key: rec.key,
        value: typeof rec.value === 'string' ? rec.value : undefined,
        type: typeof rec.type === 'string' ? rec.type : undefined,
        target: Array.isArray(rec.target) ? (rec.target as string[]) : undefined,
      })
    }
    return opsOk(records)
  }

  private envCollectionUrl(opts: { upsert: boolean }): string {
    const base = `${this.apiBase}/v9/projects/${encodeURIComponent(this.projectId)}/env`
    const qs = new URLSearchParams()
    if (opts.upsert) qs.set('upsert', 'true')
    if (this.teamId) qs.set('teamId', this.teamId)
    const tail = qs.toString()
    return tail ? `${base}?${tail}` : base
  }

  private async request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
  ): Promise<OpsResult<unknown>> {
    let res: Response
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return opsError('NETWORK', `network error: ${message}`)
    }

    if (res.status === 204) return opsOk(null)
    if (res.ok) {
      const text = await res.text()
      if (text.length === 0) return opsOk(null)
      try {
        return opsOk(JSON.parse(text))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return opsError('MALFORMED_RESPONSE', `failed to parse JSON: ${message}`, {
          status: res.status,
        })
      }
    }
    return mapHttpError(res)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the operator-visible env var name — wrapped in `OpsResult` so
 * an empty/invalid functionId surfaces as a typed error rather than
 * throwing past the adapter boundary.
 */
function safeEnvName(
  functionId: string,
): { ok: true; value: string } | { ok: false; error: OpsError } {
  try {
    return { ok: true, value: disableFlagEnvName(functionId) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return opsError('INVALID_ARGUMENT', `cannot derive env-var name: ${message}`)
  }
}

async function mapHttpError(res: Response): Promise<{ ok: false; error: OpsError }> {
  let detail: string | undefined
  try {
    const body = (await res.json()) as { error?: { message?: string } | string; message?: string }
    if (typeof body?.error === 'string') detail = body.error
    else if (body?.error && typeof body.error === 'object') detail = body.error.message
    if (!detail && typeof body?.message === 'string') detail = body.message
  } catch {
    // body wasn't JSON; ignore
  }
  const baseMsg = detail ?? res.statusText ?? `HTTP ${res.status}`

  if (res.status === 404) {
    return opsError('NOT_FOUND', baseMsg, { status: 404, reference: VERCEL_ENV_DOCS })
  }
  if (res.status === 401) {
    return opsError('UNAUTHORIZED', baseMsg, { status: 401, reference: VERCEL_ENV_DOCS })
  }
  if (res.status === 403) {
    return opsError('FORBIDDEN', baseMsg, { status: 403, reference: VERCEL_ENV_DOCS })
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after')
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined
    return opsError('RATE_LIMITED', baseMsg, {
      status: 429,
      reference: VERCEL_ENV_DOCS,
      retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
    })
  }
  if (res.status === 422 || res.status === 409) {
    return opsError('CONFLICT', baseMsg, { status: res.status, reference: VERCEL_ENV_DOCS })
  }
  if (res.status >= 500) {
    return opsError('UPSTREAM_ERROR', baseMsg, { status: res.status, reference: VERCEL_ENV_DOCS })
  }
  return opsError('UPSTREAM_ERROR', baseMsg, { status: res.status, reference: VERCEL_ENV_DOCS })
}

// Re-export the helper so call sites that already import the adapter can
// avoid an extra import line. Pure convenience.
export { isFunctionDisabled, disableFlagEnvName }
