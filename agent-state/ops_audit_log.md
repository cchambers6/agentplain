---
name: ops_audit_log
description: Append-only audit log of every ops control-plane mutation/observation. Owned by scripts/ops/throttle.ts (lands in a follow-on PR) and the future org-ops-management agent. Newest at bottom (chronological).
type: project
created: 2026-05-11
originSessionId: pr-a-foundation-port-2026-05-11
---

# Ops audit log

Append-only. Every row is written AFTER reading back actual state from the adapter (per `feedback_verify_after_create`).

Seeded empty by PR-A (foundation port of flatsbo PR #24's `lib/ops` adapter layer). Throttle CLI and first audit rows land in a follow-on PR; the schema for each row is documented in `lib/ops/README.md`.
