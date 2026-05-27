/**
 * lib/customer-data/index.ts
 *
 * Customer-controlled data surfaces: export and workspace closure. Pairs
 * with `lib/customer-files/deletion.ts` (the executor): this module owns
 * the customer-facing decision (export, soft-close, cancel); deletion.ts
 * owns the row-level purge.
 */

export {
  buildWorkspaceExport,
  EXPORT_SCHEMA_VERSION,
  PER_TABLE_ROW_CAP,
} from './export';
export type {
  BuildWorkspaceExportArgs,
  WorkspaceExportArtifact,
  WorkspaceExportMetadata,
} from './export';

export {
  initiateWorkspaceClosure,
  cancelWorkspaceClosure,
  readWorkspaceClosureState,
  TypedConfirmationMismatchError,
  DEFAULT_GRACE_DAYS,
  getGraceDays,
} from './closure';
export type {
  InitiateWorkspaceClosureInput,
  InitiateWorkspaceClosureResult,
  CancelWorkspaceClosureInput,
  CancelWorkspaceClosureResult,
  WorkspaceClosureView,
} from './closure';

export {
  findWorkspacesDueForHardPurge,
  hardPurgeWorkspace,
  workspaceTeardownSweepFn,
  WORKSPACE_TEARDOWN_SWEEP_FUNCTION_ID,
  WORKSPACE_TEARDOWN_SWEEP_CRON,
  WORKSPACE_TEARDOWN_SWEEP_TRIGGER_EVENT,
  PER_SWEEP_LIMIT,
} from './teardown-scheduler';
export type {
  DuePurgeCandidate,
  HardPurgeResult,
} from './teardown-scheduler';
