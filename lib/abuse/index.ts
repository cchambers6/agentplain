/**
 * lib/abuse/index.ts
 *
 * Public surface of the abuse-protection module. Detection is pure
 * (`detector.ts`); consequence is a state machine behind a storage port
 * (`suspend.ts`). The access-audit log that feeds detection lives in
 * `lib/observability/access-audit.ts`.
 */

export * from './detector';
export * from './suspend';
