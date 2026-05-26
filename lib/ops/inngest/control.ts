/**
 * Inngest control-plane adapter.
 *
 * The pause/resume flag is now DB-backed via `OpsFlagStore` (P0-4) —
 * `OpsFlag` is the source of truth, read by every Inngest function
 * invocation through `lib/inngest/run-with-disable-gate.ts`. The Vercel
 * env-var mirror is retained as a best-effort cold-start cache so a
 * function fired during a brief DB outage still finds its flag in the
 * env it booted with.
 *
 * Why both surfaces? The DB write makes the pause take effect on the
 * NEXT cron tick (was 5+ minutes via env-only; see the assessment for
 * the original measurement). The env mirror keeps the prior behavior as
 * a defense-in-depth fallback — the gate's env path stays meaningful so
 * a DB outage cannot silently un-pause every cron in the system.
 *
 * Write semantics (per `feedback_no_quick_fixes`): the DB write is the
 * gate. If it fails, the call returns an error and the env mirror is
 * NOT attempted (no half-mutation). If the DB write succeeds and the
 * env mirror fails, the call still succeeds — the caller can re-run to
 * heal the mirror later, and the gate will already honor the DB on the
 * next tick. The env mirror is therefore "best effort": its failure is
 * downgraded to a warning, never an error.
 *
 * The env mirror is OPT-IN — if the caller does not supply Vercel
 * credentials, the adapter operates DB-only and `getInngestFunctionStatus`
 * reads from the DB. This is the production shape on hosts that do not
 * expose the Vercel admin API (e.g. local dev without a Vercel token).
 *
 * Inngest itself still does not publish a public REST API for pausing
 * cron functions (verified at https://www.inngest.com/docs/guides/pause-functions
 * on 2026-05-10 — pause is exclusively a Cloud-UI operation), so the
 * in-house flag pattern remains the load-bearing primitive even after
 * the DB cutover. Per
 * `feedback_no_silent_vendor_lock` + `project_living_portable_architecture`:
 * if Inngest ships a real pause API tomorrow only this file changes.
 *
 * Vercel REST endpoints used for the env mirror (documented at
 * https://vercel.com/docs/rest-api/reference/endpoints/projects):
 *   POST   /v9/projects/{id}/env?upsert=true   create-or-update single env var
 *   GET    /v9/projects/{id}/env               list all env vars (we filter by key)
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
import type { OpsFlagStore } from '../flag-store'

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
   * DB-backed flag store. REQUIRED — this is the source of truth for
   * pause state after P0-4. Production: pass a `PrismaOpsFlagStore`.
   * Tests: pass an `InMemoryOpsFlagStore`.
   */
  flagStore: OpsFlagStore
  /**
   * Vercel project id (e.g. `prj_XXX`). Optional after P0-4 — if absent,
   * the env mirror is skipped and the adapter operates DB-only. If
   * present, must be paired with a token.
   */
  vercelProjectId?: string
  /**
   * Vercel API token. Falls back to `VERCEL_TOKEN` env var when
   * `vercelProjectId` is set; ignored when there is no project id.
   *
   * Per `feedback_no_prod_secrets_in_dev` — this is an account-level
   * secret. In `.env.local` use a dev-tier scoped token (read-only or
   * limited project access) NOT the same value as Vercel Production.
   * See lib/ops/README.md credentials section.
   */
  vercelToken?: string
  /** Optional Vercel team scope. Pass when the project is team-owned. */
  vercelTeamId?: string
  /**
   * Inngest app id used as a label on errors / audit rows. Optional —
   * no functional role. Kept so log lines say `app=agentplain-prod`
   * rather than the bare project id.
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
  /**
   * Free-text actor string written to `OpsFlag.updatedBy`. Defaults to
   * `'cli:throttle.ts'`. Other callers (the org-ops-management agent
   * when it lands) should pass their own identifier.
   */
  actor?: string
  /**
   * Hook invoked when the best-effort Vercel env mirror fails. Defaults
   * to a no-op. The CLI passes a logger so the operator sees the
   * blocker; tests assert it was invoked.
   */
  onEnvMirrorFailure?: (err: OpsError) => void
}

interface VercelEnvRecord {
  id: string
  key: string
  value?: string
  type?: string
  target?: string[]
}

export class InngestControlAdapter implements OpsControlPlane {
  private readonly flagStore: OpsFlagStore
  private readonly projectId: string | null
  private readonly token: string | null
  private readonly teamId?: string
  private readonly appId: string
  private readonly apiBase: string
  private readonly fetchImpl: typeof fetch
  private readonly targets: ReadonlyArray<'production' | 'preview' | 'development'>
  private readonly actor: string
  private readonly onEnvMirrorFailure: (err: OpsError) => void

  constructor(config: InngestControlConfig) {
    if (!config.flagStore) {
      throw new Error('InngestControlAdapter: flagStore is required (P0-4)')
    }
    this.flagStore = config.flagStore
    this.appId = config.appId ?? '(unspecified)'
    this.apiBase = config.apiBase ?? DEFAULT_API_BASE
    this.fetchImpl = config.fetchImpl ?? fetch
    this.targets = config.targets ?? DEFAULT_TARGETS
    this.actor = config.actor ?? 'cli:throttle.ts'
    this.onEnvMirrorFailure = config.onEnvMirrorFailure ?? (() => undefined)

    // Vercel mirror is opt-in. Either supply BOTH projectId + token (or
    // env-resolved token), or supply NEITHER. Half a credential set
    // disables the mirror outright.
    if (config.vercelProjectId) {
      const token = config.vercelToken ?? process.env.VERCEL_TOKEN
      if (!token) {
        throw new Error(
          'InngestControlAdapter: vercelProjectId set but no token. Set VERCEL_TOKEN or pass `vercelToken`, or omit vercelProjectId to disable the env mirror.',
        )
      }
      this.projectId = config.vercelProjectId
      this.token = token
      this.teamId = config.vercelTeamId
    } else {
      this.projectId = null
      this.token = null
    }
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

  // ── Inngest pause/resume/status — DB source of truth + env mirror ───

  async pauseInngestFunction(functionId: string): Promise<OpsResult<void>> {
    return this.writeFlag(functionId, 'true')
  }

  async resumeInngestFunction(functionId: string): Promise<OpsResult<void>> {
    // Set explicit "false" rather than DELETE — both states observable,
    // mirrors the USE_GHA_CRON pattern, and the gate already treats
    // missing/'false'/garbage identically so this is purely about
    // having a deterministic read-back value for ops.
    return this.writeFlag(functionId, 'false')
  }

  async getInngestFunctionStatus(
    functionId: string,
  ): Promise<OpsResult<InngestFunctionStatus>> {
    const envName = safeEnvName(functionId)
    if (!envName.ok) return envName

    // DB is source of truth — always consult it first.
    const dbRead = await this.flagStore.get(envName.value)
    if (dbRead.ok) {
      if (dbRead.value !== null) {
        if (dbRead.value.value === 'true') {
          return opsOk({ functionId, pauseState: 'paused' })
        }
        if (dbRead.value.value === 'false') {
          return opsOk({ functionId, pauseState: 'active' })
        }
        // Some other value — surface as 'unknown' so ops notices the drift.
        return opsOk({ functionId, pauseState: 'unknown' })
      }
      // No DB row → fall through to env mirror (or "active" default).
    }

    // No env mirror configured → DB-only mode; missing row means active.
    if (!this.projectId || !this.token) {
      return opsOk({ functionId, pauseState: 'active' })
    }

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
    return opsOk({ functionId, pauseState: 'unknown' })
  }

  // ── Internal: write path ─────────────────────────────────────────────

  private async writeFlag(
    functionId: string,
    value: 'true' | 'false',
  ): Promise<OpsResult<void>> {
    const envName = safeEnvName(functionId)
    if (!envName.ok) return envName

    // 1. DB write — source of truth. If this fails, abort: no half-mutation.
    const dbWrite = await this.flagStore.set(envName.value, value, {
      updatedBy: this.actor,
      note: `Inngest ${value === 'true' ? 'pause' : 'resume'} for ${functionId} (app=${this.appId})`,
    })
    if (!dbWrite.ok) return dbWrite

    // 2. Env mirror — best effort. Skip if no Vercel credentials.
    if (!this.projectId || !this.token) return opsOk(undefined)

    const mirrorResult = await this.writeEnvMirror(envName.value, value)
    if (!mirrorResult.ok) {
      // Surface for the operator/CLI without failing the call. The DB
      // is the gate; the mirror is the cold-start cache. A divergence
      // here heals on the next successful write.
      this.onEnvMirrorFailure(mirrorResult.error)
    }
    return opsOk(undefined)
  }

  private async writeEnvMirror(
    envName: string,
    value: 'true' | 'false',
  ): Promise<OpsResult<void>> {
    const url = this.envCollectionUrl({ upsert: true })
    const body = {
      key: envName,
      value,
      type: 'plain',
      target: this.targets,
      comment: `Inngest disable flag mirror (DB is source of truth — see OpsFlag.${envName}). Managed by lib/ops/inngest/control.ts.`,
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
    const base = `${this.apiBase}/v9/projects/${encodeURIComponent(this.projectId ?? '')}/env`
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
