# Copy Ruling — /security page softening

**Date:** 2026-07-03  
**Ruling:** Option A — soften to defensible claims only  
**Rationale:** No new funded hardening workstream is authorized (RATIFIED KILL #7). The current absolute SLA commitments in the Incident Response section imply a formal on-call rotation and incident-response team that does not exist. Option B (fund the hardening) is blocked by KILL #7 until the profitable milestone fires.

**Source:** CEO Pass 1 (Contradiction 1) + `project_master_synthesis_2026_07_02`  
**Applies to:** `app/(marketing)/security/page.tsx`  
**Follow-up PR:** Apply these exact replacements to the file.

---

## Changes required

### Section: Incident Response

**Current (ABSOLUTE — unfunded):**
```
If we detect or are notified of a security incident affecting
customer data, we will: (1) contain the incident within 24 hours of
confirmed detection; (2) notify affected workspace owners by email
within 72 hours of confirming the scope; (3) publish a post-mortem
with root cause, timeline, and remediation steps. Notification
windows compress for incidents we judge to warrant immediate
disclosure regardless of investigation status.
```

**Replacement (DEFENSIBLE):**
```
If we detect or are notified of a security incident affecting
customer data, we will: (1) work to contain the incident as quickly
as possible after confirmed detection; (2) notify affected workspace
owners by email once the scope is confirmed — we aim to do this
within 72 hours and will notify sooner for incidents warranting
immediate disclosure; (3) publish a post-mortem with root cause,
timeline, and remediation steps.
```

**Why this change:** "Within 24 hours" is an enterprise-grade SLA that presupposes a staffed on-call rotation. At current scale (single operator, no IR team), it is not a defensible promise. The replacement commits to prompt action and retains the 72-hour email notification as an aim (not a hard SLA), consistent with what a responsible single-operator service can actually deliver. The post-mortem commitment is retained in full — it costs only transparency.

---

### Section: Credential Handling — personal name reference

**Current:**
```
Internal access to the production environment is limited to the
workspace owner (Conner Chambers) and is gated behind multi-factor
authentication on the Vercel account.
```

**Replacement:**
```
Internal access to the production environment is limited to the
founding team and is gated behind multi-factor authentication on
the Vercel account.
```

**Why this change:** Naming a private individual in a public legal document creates unnecessary personal exposure as the team grows. "Founding team" is accurate, defensible, and age-stable.

---

### No changes to these sections

The following sections are architecture-grounded, verifiably true, and require no softening:

- **Encryption at rest** — AES-256-GCM with per-environment key in Vercel secrets store: TRUE (code in `lib/encryption/`)
- **Encryption in transit** — TLS 1.2+ on all connections: TRUE (Vercel edge enforces this)
- **Workspace isolation** — RLS policies in Postgres, `workspace_id` on every row: TRUE (PR #298)
- **OAuth scope minimization** — read-and-draft scopes only for email, read-only for files and accounting: TRUE (connector implementations in `lib/integrations/`)
- **Audit logs** — append-only handoff log, visible to workspace owner: TRUE (handoff log schema and UI in place)
- **Subprocessor security** — Anthropic named in subprocessor context: TRUE and ALLOWED (legal exception to vendor-invisible rule per `feedback_model_vendor_invisible_on_customer_surfaces`)
- **Backups + disaster recovery** — Neon daily backups with PITR: TRUE per Neon's default plan; verify PITR is enabled on the Neon dashboard before asserting this live

---

## Voice-gate compliance check

Changes use plain direct language with no LLM-ese patterns (A–D) and no hype (brand-gate R4). Softened language ("work to contain," "as quickly as possible," "we aim to") is the customer-vocab register for honest service commitments. Pass.
