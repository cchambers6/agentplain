// Re-export shim so the filesystem-derived registry discovers this function.
//
// The implementation lives in lib/customer-data/teardown-scheduler.ts because
// it shares that module's data-lifecycle logic (purge windows, retention
// policy). But the registry (lib/inngest/registry.ts) discovers functions by
// scanning lib/inngest/functions/ — so this one-line re-export is what makes
// the teardown sweep visible to that scan without moving its implementation.
//
// Do NOT add logic here. To change the teardown sweep, edit
// lib/customer-data/teardown-scheduler.ts.
export { workspaceTeardownSweepFn } from "@/lib/customer-data";
