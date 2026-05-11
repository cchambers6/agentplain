/**
 * In-memory `OpsControlPlane` for tests + dry-run CLI mode.
 *
 * Satisfies `feedback_runner_portability`: every adapter category has at
 * least two implementations. Keep the behavioral surface in sync with
 * the production adapters' contract (see contract.test.ts).
 *
 * This implementation IS NOT a mock — it's a real, parallel
 * implementation that maintains state across calls. The CLI uses it for
 * `--dry-run`; the contract tests parameterize over both
 * `TestOpsControlPlane` and the production adapters (with mocked HTTP).
 */

import type {
  InngestFunctionStatus,
  OpsControlPlane,
  OpsResult,
  RepoVariable,
} from './types'
import { opsError, opsOk } from './types'

export interface TestOpsSeed {
  /** Initial repo variables. */
  repoVariables?: Record<string, string>
  /** Initial pause states for known Inngest function ids. */
  inngestPauseState?: Record<string, 'paused' | 'active'>
}

export class TestOpsControlPlane implements OpsControlPlane {
  private readonly variables: Map<string, { value: string; updatedAt: string }>
  private readonly pauseState: Map<string, 'paused' | 'active'>
  private readonly lastRun: Map<string, string>

  constructor(seed: TestOpsSeed = {}) {
    this.variables = new Map()
    this.pauseState = new Map()
    this.lastRun = new Map()
    for (const [k, v] of Object.entries(seed.repoVariables ?? {})) {
      this.variables.set(k, { value: v, updatedAt: new Date().toISOString() })
    }
    for (const [k, v] of Object.entries(seed.inngestPauseState ?? {})) {
      this.pauseState.set(k, v)
    }
  }

  async getRepoVariable(key: string): Promise<OpsResult<RepoVariable>> {
    const entry = this.variables.get(key)
    if (!entry) return opsError('NOT_FOUND', `repo variable not found: ${key}`)
    return opsOk({ name: key, value: entry.value, updatedAt: entry.updatedAt })
  }

  async setRepoVariable(key: string, value: string): Promise<OpsResult<RepoVariable>> {
    const updatedAt = new Date().toISOString()
    this.variables.set(key, { value, updatedAt })
    return opsOk({ name: key, value, updatedAt })
  }

  async pauseInngestFunction(functionId: string): Promise<OpsResult<void>> {
    this.pauseState.set(functionId, 'paused')
    return opsOk(undefined)
  }

  async resumeInngestFunction(functionId: string): Promise<OpsResult<void>> {
    this.pauseState.set(functionId, 'active')
    return opsOk(undefined)
  }

  async getInngestFunctionStatus(functionId: string): Promise<OpsResult<InngestFunctionStatus>> {
    const state = this.pauseState.get(functionId) ?? 'active'
    return opsOk({
      functionId,
      pauseState: state,
      lastRunAt: this.lastRun.get(functionId),
    })
  }

  /** Test helper: synthesize a recent-run timestamp. */
  recordRun(functionId: string, isoTimestamp: string = new Date().toISOString()): void {
    this.lastRun.set(functionId, isoTimestamp)
  }
}
