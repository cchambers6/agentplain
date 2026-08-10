# AI Headmaster POC — Data Model

Prisma schema for every entity in the brief, plus migration plan, indexes, and RLS. Design invariants:

- **No curriculum content column exists anywhere.** The core rule is enforced by schema shape, not just prompts.
- **Child.model is materialized JSONB + an append-only event table** so acceptance criterion 3 (≥3 traceable adjustments) is a query.
- **Every table carries `family_id`** and RLS scopes on it, even though the POC has one family (v1 multi-tenant becomes config, per the PR #298 pattern).

## prisma/schema.prisma (v0)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Family {
  id            String   @id @default(cuid())
  name          String
  timezone      String   @default("America/New_York")
  schoolDays    Int[]                       // [1,2,3,4] = Mon–Thu (4-day week)
  state         String   @default("GA")
  philosophyKey String   @default("charlotte-mason")  // philosophy pack selector
  createdAt     DateTime @default(now())

  children      Child[]
  curricula     Curriculum[]
  weeklyPlans   WeeklyPlan[]
  budget        FamilyBudget?
}

model Child {
  id        String   @id @default(cuid())
  familyId  String
  family    Family   @relation(fields: [familyId], references: [id])
  firstName String
  birthYear Int
  stage     String   @default("grammar")   // grammar | logic | rhetoric

  /// Materialized longitudinal model. Shape (versioned by modelVersion):
  /// { modalities: {...}, strengths: [...], struggles: [...],
  ///   pacing: {subject: "ahead"|"on"|"behind"}, interests: [...] }
  model        Json     @default("{}")
  modelVersion Int      @default(0)        // bumped by each applied ChildModelUpdate

  modelUpdates ChildModelUpdate[]
  dailyLogs    DailyLog[]

  @@index([familyId])
}

model Curriculum {
  id        String  @id @default(cuid())
  familyId  String
  family    Family  @relation(fields: [familyId], references: [id])
  title     String                          // e.g. "Math with Confidence 1"
  publisher String?
  subject   String                          // math | language-arts | science | ...
  edition   String?
  /// METADATA ONLY — deliberately no content/text column anywhere below.
  units     CurriculumUnit[]
  parentNotes String?                       // the parent's own words, not the publisher's

  @@index([familyId])
}

model CurriculumUnit {
  id           String     @id @default(cuid())
  curriculumId String
  curriculum   Curriculum @relation(fields: [curriculumId], references: [id])
  ordinal      Int                          // sequence position
  label        String                       // "Unit 3: Addition to 20" — publisher's ToC label only
  lessonCount  Int
  estMinutesPerLesson Int?
  skillTags    String[]                     // ["addition", "number-bonds"]
  prerequisiteOrdinals Int[]                // intra-curriculum ordering constraints

  @@unique([curriculumId, ordinal])
}

model IntegrationMap {
  id        String   @id @default(cuid())
  familyId  String
  version   Int                             // new row per Integrator run; latest wins
  createdAt DateTime @default(now())
  /// Output of the Integrator (shape in 03-agent-prompts.md):
  /// { subjects: [...], weeklyRhythm: {...}, threads: [{theme, unitRefs}],
  ///   sequencing: [{before, after, reason}], conflicts: [{description, resolution|null}] }
  map       Json
  conflictsOpen Int  @default(0)            // denormalized count of unresolved conflicts

  @@unique([familyId, version])
}

model WeeklyPlan {
  id          String    @id @default(cuid())
  familyId    String
  family      Family    @relation(fields: [familyId], references: [id])
  weekStart   DateTime                       // Monday of the plan week
  status      String    @default("planned")  // planned | active | replanned | completed
  /// Headmaster rationale rows — the traceability half of acceptance #3:
  /// [{ change: "...", modelUpdateIds: ["cmu_..."], dailyLogIds: ["dl_..."] }]
  rationale   Json      @default("[]")
  fridayReport Json?                          // filled by the Friday run
  dayPlans    DayPlan[]

  @@unique([familyId, weekStart])
}

model DayPlan {
  id           String     @id @default(cuid())
  weeklyPlanId String
  weeklyPlan   WeeklyPlan @relation(fields: [weeklyPlanId], references: [id])
  date         DateTime
  /// Blocks reference curriculum units by id + lesson ordinal — never content:
  /// [{ childId, curriculumId, unitId, lessonOrdinal, estMinutes, note }]
  blocks       Json
  status       String     @default("planned") // planned | done | partial | skipped

  @@unique([weeklyPlanId, date])
  @@index([date])
}

model DailyLog {
  id          String   @id @default(cuid())
  familyId    String
  childId     String
  child       Child    @relation(fields: [childId], references: [id])
  date        DateTime
  dayPlanId   String?
  /// Structured completion: [{ blockRef, status: done|partial|skipped, minutes }]
  completion  Json     @default("[]")
  /// Full debrief conversation (parent+agent turns), persisted per turn.
  debriefTranscript Json @default("[]")
  debriefClosedAt   DateTime?
  /// Extraction outcome: triage verdict + which ChildModelUpdates were applied.
  extraction  Json?    // { triage: "routine"|"rich", deepPass: bool, updateIds: [...] }

  modelUpdates ChildModelUpdate[]

  @@unique([childId, date])
  @@index([familyId, date])
}

model ChildModelUpdate {
  id         String   @id @default(cuid())
  childId    String
  child      Child    @relation(fields: [childId], references: [id])
  dailyLogId String                          // REQUIRED — every update traces to a log
  dailyLog   DailyLog @relation(fields: [dailyLogId], references: [id])
  createdAt  DateTime @default(now())
  /// JSON-patch-style delta against Child.model, plus the evidence:
  /// { path: "struggles", op: "add", value: {...},
  ///   evidence: "<verbatim parent observation from the debrief>" }
  patch      Json
  appliedVersion Int                         // Child.modelVersion after applying

  @@index([childId, createdAt])
}

model ComplianceRecord {
  id        String   @id @default(cuid())
  familyId  String
  childId   String
  date      DateTime
  /// Georgia home-study needs attendance + subject coverage. Structured:
  /// { attended: bool, subjects: ["reading","math",...], minutes: {...} }
  record    Json
  source    String   @default("rules")      // rules | haiku-edge-case
  createdAt DateTime @default(now())

  @@unique([childId, date])
  @@index([familyId, date])
}

model FamilyBudget {
  familyId     String  @id
  family       Family  @relation(fields: [familyId], references: [id])
  monthCents   Int     @default(1000)       // $10 hard ceiling
  spentCents   Int     @default(0)          // current calendar month
  monthKey     String                        // "2026-07"; reset on rollover
  lastCallAt   DateTime?
}

model LlmCallLog {
  id         String   @id @default(cuid())
  familyId   String
  agent      String                          // integrator | headmaster | tutor | registrar
  model      String
  inputTokens  Int
  outputTokens Int
  cacheReadTokens  Int @default(0)
  cacheWriteTokens Int @default(0)
  costMicrocents   Int                       // computed at call time from a price table
  createdAt  DateTime @default(now())

  @@index([familyId, createdAt])
}
```

## Acceptance-criterion-3 query (designed in, not bolted on)

```sql
SELECT wp.week_start, r->>'change' AS adjustment,
       cmu.id AS model_update, cmu.patch->>'evidence' AS observation,
       dl.date AS observed_on
FROM weekly_plan wp,
     jsonb_array_elements(wp.rationale) r
JOIN child_model_update cmu ON cmu.id = ANY (SELECT jsonb_array_elements_text(r->'modelUpdateIds'))
JOIN daily_log dl ON dl.id = cmu.daily_log_id;
```

≥3 rows spanning ≥2 distinct weeks = criterion met, no cherry-picking possible (doc 07 §5).

## Migrations plan

1. `0001_init` — everything above in one migration (greenfield repo; no legacy to stage around).
2. `0002_rls` — raw SQL migration enabling RLS (below). Raw-SQL migrations get a drift-baseline entry per `project_schema_drift_baseline_for_raw_indexes` — the same trap agentplain hit; don't re-learn it.
3. Migration gating on deploy copied from agentplain's `scripts/prisma-migrate-gate.mjs` + the PR #307 rule: migrate runs only when `VERCEL_ENV=production`, so preview deploys can't race the DB (and a Neon outage doesn't red the build).
4. Seed: `prisma/seed-demo.ts` creates the synthetic family/child/curricula (doc 05) — mirrors agentplain's `prisma/seed-demo.ts` + `scripts/reset-demo.mjs` pattern from PR #377.

## Indexes

Declared inline above. The load-bearing ones: `DailyLog(childId, date)` unique (one log per child-day — idempotent daily loop), `ChildModelUpdate(childId, createdAt)` (Headmaster reads "updates since last plan"), `DayPlan(date)` (today lookup), `LlmCallLog(familyId, createdAt)` (budget meter month-scan).

## RLS policy

Pattern from agentplain PR #298 (`project_memory_scale_rls_tiering_byo_2026_06_18`), with `family_id` in the role agentplain gives `workspace_id`:

```sql
-- 0002_rls (raw SQL migration, applied to every table carrying family_id)
ALTER TABLE daily_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY family_isolation ON daily_log
  USING (family_id = current_setting('app.family_id', true));
-- ... identical policy per table; child-scoped tables join through child.family_id
```

The app sets `app.family_id` per request (`SET LOCAL` inside the transaction). POC has one family, so this is belt-and-suspenders — but it's exactly the lesson from agentplain audit #330 ("portal tables outside safety nets"): tables added *without* the net are the ones that leak later. Ship the net first.

**RLS in CI:** a smoke test asserts a connection with the wrong `app.family_id` reads zero rows from every family-scoped table — the same gate Legal hard-stopped agentplain's DPA on (PR #360: "portal RLS in CI"). We inherit the lesson, not the incident.
