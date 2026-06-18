/**
 * lib/integrations/approval/index.ts
 *
 * Barrel for the connector-agnostic approval gate. Connector factories build a
 * gate + audit sink here and pass them to their own approval decorator.
 *
 * Default wiring helper: `buildConnectorApprovalDeps()` returns the in-memory
 * gate+sink under `INTEGRATIONS_PROVIDER=test` and the Prisma gate+sink
 * otherwise — the same env switch every connector factory already uses.
 */

import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from './approval-gate-memory';
import { PrismaConnectorApprovalGate } from './approval-gate-prisma';
import { PrismaConnectorActionAuditSink } from './audit';
import type {
  ConnectorApprovalGate,
  ConnectorActionAuditSink,
} from './with-approval';

export {
  type GatedAction,
  type ConnectorApprovalGate,
  type ConnectorApprovalGrant,
  type ConnectorActionAuditSink,
  type ConnectorActionAuditEntry,
  fingerprintAction,
  gateAndRun,
  approvalRequired,
} from './with-approval';

export {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
  type SeedGrantArgs,
} from './approval-gate-memory';

export {
  PrismaConnectorApprovalGate,
  CONNECTOR_APPROVAL_TTL_MS,
} from './approval-gate-prisma';

export {
  PrismaConnectorActionAuditSink,
  NoopConnectorActionAuditSink,
} from './audit';

export interface ConnectorApprovalDeps {
  gate: ConnectorApprovalGate;
  audit: ConnectorActionAuditSink;
}

/**
 * The env-switched gate + audit sink. Connector factories call this when the
 * caller does not inject its own (tests inject an in-memory gate to seed
 * grants deterministically).
 */
export function buildConnectorApprovalDeps(): ConnectorApprovalDeps {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return {
      gate: new InMemoryConnectorApprovalGate(),
      audit: new InMemoryConnectorActionAuditSink(),
    };
  }
  return {
    gate: new PrismaConnectorApprovalGate(),
    audit: new PrismaConnectorActionAuditSink(),
  };
}
