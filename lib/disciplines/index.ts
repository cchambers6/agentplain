/**
 * lib/disciplines/index.ts
 *
 * Source-of-truth module for the 8 customer-facing disciplines introduced
 * by the Strand 1 fleet expansion plan (`docs/fleet-expansion-plan-2026-05-27.md`).
 *
 * Disciplines are the customer-facing organizing unit ABOVE the vertical
 * axis. A workspace's vertical decides which integrations + skills are
 * relevant; the discipline is the dimension the customer thinks in
 * ("my analytics work", "my legal work"). Strand 3's UX wedge surfaces
 * disciplines as the seam under the marketplace, approval queue, and
 * agent roster so the expanded fleet (8 disciplines × 11 verticals) does
 * not collapse into a tile dump.
 *
 * Per `project_service_partnership_positioning.md`: each description is
 * written from the service-partner perspective ("we do the work"), never
 * DIY framing ("you do the work with our tool"). Plaino is the named
 * service partner that carries each discipline — same heritage voice.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every surface that needs the
 * discipline list (panel, marketplace facet, approval queue grouping,
 * detail page) reads from `listDisciplines()`. Slug strings live nowhere
 * else.
 */

import { z } from 'zod';

/** Stable discipline identifier — used in URLs, DB rows, facet chips. */
export type DisciplineId =
  | 'analytics'
  | 'research'
  | 'legal'
  | 'marketing'
  | 'sales-enablement'
  | 'customer-success'
  | 'finance'
  | 'operations';

export interface Discipline {
  /** Kebab-case slug. The `discipline` column on `WorkApprovalQueueItem`
   *  and the `disciplines[]` field on marketplace entries take this value
   *  verbatim. */
  id: DisciplineId;
  /** Display name in the customer surface. Title case, brand voice. */
  name: string;
  /** One-sentence service-partnership description. NOT DIY — written from
   *  the perspective of "we do this work for you", per the Plaino voice
   *  rules in `project_plaino_named_agent.md`. */
  description: string;
  /** Lucide-icon name. The discipline panel + detail header reads this as
   *  a class hint; the renderer falls back to the wheat motif when no
   *  icon ships. We DO NOT bundle a Lucide dependency for this PR — the
   *  iconKey is a forward-compatible label so the panel layout can hoist
   *  a real icon later without a schema change. */
  iconKey: string;
  /** Display order (lowest first). The panel grid + facet chips read
   *  this rather than relying on object-literal order. */
  sortOrder: number;
}

const DisciplineSchema = z.object({
  id: z.enum([
    'analytics',
    'research',
    'legal',
    'marketing',
    'sales-enablement',
    'customer-success',
    'finance',
    'operations',
  ]),
  name: z.string().min(1),
  description: z.string().min(1),
  iconKey: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});

const DISCIPLINES_RAW: Discipline[] = [
  {
    id: 'analytics',
    name: 'Analytics',
    description:
      'We pull the numbers your team needs to make decisions — weekly reads, monthly trends, the chart you would have spent Friday afternoon building.',
    iconKey: 'bar-chart',
    sortOrder: 10,
  },
  {
    id: 'research',
    name: 'Research',
    description:
      'We comb the sources you point us at, surface what is new, and draft the brief — you read the brief, we keep watching.',
    iconKey: 'book-open',
    sortOrder: 20,
  },
  {
    id: 'legal',
    name: 'Legal',
    description:
      'We read every customer-facing draft against your compliance corpus, flag the load-bearing clauses, and route what counsel needs to see.',
    iconKey: 'scale',
    sortOrder: 30,
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description:
      'We draft posts, emails, and landing copy in your voice — you approve before anything leaves your accounts.',
    iconKey: 'megaphone',
    sortOrder: 40,
  },
  {
    id: 'sales-enablement',
    name: 'Sales enablement',
    description:
      'We prep the pre-call brief, draft the follow-up, and keep your pipeline honest — your team carries the conversation.',
    iconKey: 'handshake',
    sortOrder: 50,
  },
  {
    id: 'customer-success',
    name: 'Customer success',
    description:
      'We watch your inbox + threads for accounts that need a hand, draft the check-in, and flag what cannot wait.',
    iconKey: 'life-buoy',
    sortOrder: 60,
  },
  {
    id: 'finance',
    name: 'Finance',
    description:
      'We chase the unpaid invoice, draft the books reconciliation, and prep the close — your CPA still reviews.',
    iconKey: 'coins',
    sortOrder: 70,
  },
  {
    id: 'operations',
    name: 'Operations',
    description:
      'We run the admin work that takes time and money away from the people you serve — scheduling, doc chasing, status updates, routine triage.',
    iconKey: 'gauge',
    sortOrder: 80,
  },
];

const DISCIPLINES: readonly Discipline[] = (() => {
  const validated = DISCIPLINES_RAW.map((d) => DisciplineSchema.parse(d));
  const ids = new Set(validated.map((d) => d.id));
  if (ids.size !== validated.length) {
    throw new Error('lib/disciplines: duplicate id in DISCIPLINES_RAW');
  }
  return [...validated].sort((a, b) => a.sortOrder - b.sortOrder);
})();

/** Every discipline, sorted by `sortOrder`. */
export function listDisciplines(): readonly Discipline[] {
  return DISCIPLINES;
}

/** Resolve a discipline id to its full record. Returns null on unknown ids
 *  so callers (route handlers, facet chips) decide whether to 404. */
export function getDiscipline(id: string): Discipline | null {
  return DISCIPLINES.find((d) => d.id === id) ?? null;
}

/** Narrow a free-form string to a `DisciplineId` for use in route params
 *  and queue rows. Returns null for anything outside the locked 8. */
export function asDisciplineId(value: string | null | undefined): DisciplineId | null {
  if (!value) return null;
  const match = DISCIPLINES.find((d) => d.id === value);
  return match ? match.id : null;
}

/** Stable list of every discipline id — used by the migration backfill
 *  query and by tests that pin the surface. */
export const DISCIPLINE_IDS: readonly DisciplineId[] = DISCIPLINES.map(
  (d) => d.id,
);
