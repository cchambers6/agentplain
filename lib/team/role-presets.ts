/**
 * lib/team/role-presets.ts
 *
 * Per-vertical role presets for the multi-employee SMB (item 9 of the
 * 2026-06-17 strategic build). agentplain shipped as a single-owner
 * product; the 5–15 person CPA shop, law firm, or PM office needs an
 * out-of-box team shape so the owner doesn't have to invent one.
 *
 * A preset is a RECOMMENDATION, not a schema. It maps a human job title
 * the owner already thinks in ("Bookkeeper", "Paralegal") onto:
 *   1. one of the four policy tiers in `lib/auth/roles.ts`
 *      (OWNER / ADMIN / MEMBER / VIEWER), and
 *   2. the disciplines that title typically owns (the 8 from
 *      `lib/disciplines`), and
 *   3. the routing tags work carrying that label should flow to
 *      (consumed by `lib/team/routing.ts`).
 *
 * NOTHING here requires a migration. The preset is applied by creating
 * ordinary Membership rows at the chosen tier and (optionally) assigning
 * the suggested DisciplineHead rows — both already exist. The preset is
 * the bridge between "I run a CPA shop" and "here are the seats + routing
 * I should set up", and it feeds the onboarding playbook generator.
 *
 * Per `feedback_no_silent_vendor_lock` + the disciplines source-of-truth
 * rule: discipline ids here are the `DisciplineId` union, never loose
 * strings, so a discipline rename is a single-file compile error.
 */

import type { Role, Vertical } from '@prisma/client';
import type { DisciplineId } from '@/lib/disciplines';
import type { RoutingTag } from './routing-tags';

/** One recommended seat in a vertical's out-of-box team shape. */
export interface RolePreset {
  /** Stable key — `${vertical-lower}-${slug}`. Used in the playbook +
   *  the invite UI's "apply preset" affordance. Never shown raw. */
  key: string;
  /** Human job title the owner recognizes ("Bookkeeper", "Paralegal"). */
  title: string;
  /** Policy tier this title maps to. The seat is created as an ordinary
   *  Membership at this Role; the tier governs what they can do. */
  baseRole: Role;
  /** One-line description of what this person handles, brand voice. */
  description: string;
  /** Disciplines this title typically owns. When the owner accepts the
   *  preset, these become DisciplineHead suggestions for this seat. */
  disciplines: DisciplineId[];
  /** Work labels that should route to this seat (see routing-tags.ts). */
  routingTags: RoutingTag[];
}

/** A vertical's full out-of-box team shape. */
export interface VerticalRolePreset {
  vertical: Vertical;
  /** Display label for the vertical in the preset picker. */
  label: string;
  /** One-line framing for why this shape fits the vertical. */
  summary: string;
  roles: RolePreset[];
}

// The owner seat is identical across verticals (OWNER tier, owns nothing
// in particular because they see everything). Factored out so each
// vertical's `roles[0]` reads the same and a tier change is one edit.
function ownerSeat(title: string, description: string): RolePreset {
  return {
    key: 'owner',
    title,
    baseRole: 'OWNER',
    description,
    disciplines: [],
    routingTags: ['URGENT'],
  };
}

// A back-office "admin / front desk" seat recurs in most verticals.
const adminSeat: RolePreset = {
  key: 'admin',
  title: 'Office admin',
  baseRole: 'ADMIN',
  description:
    'Runs the front desk — scheduling, intake routing, and keeping the roster + connections tidy.',
  disciplines: ['operations', 'customer-success'],
  routingTags: ['SCHEDULING', 'INTAKE', 'ADMIN'],
};

const bookkeeperSeat: RolePreset = {
  key: 'bookkeeper',
  title: 'Bookkeeper',
  baseRole: 'MEMBER',
  description:
    'Owns the money work — invoices, reconciliations, and anything tagged billing.',
  disciplines: ['finance'],
  routingTags: ['BILLING', 'FINANCE'],
};

/**
 * The presets. One entry per Prisma `Vertical` value plus a GENERAL
 * fallback keyed off `vertical = null`. Keep this list aligned with the
 * `Vertical` enum — a new enum value should land a preset here in the
 * same PR (the resolver below falls back to GENERAL until it does).
 */
export const VERTICAL_ROLE_PRESETS: readonly VerticalRolePreset[] = [
  {
    vertical: 'CPA',
    label: 'CPA / accounting shop',
    summary:
      'Owner-CPA reviews and signs; a bookkeeper does the recurring money work; an admin handles intake.',
    roles: [
      ownerSeat(
        'Owner / CPA',
        'Reviews and signs returns, sees everything, the final word on every discipline.',
      ),
      bookkeeperSeat,
      adminSeat,
    ],
  },
  {
    vertical: 'PROPERTY_MANAGEMENT',
    label: 'Property management office',
    summary:
      'Owner sets policy; property managers own their portfolios; a maintenance coordinator routes work orders.',
    roles: [
      ownerSeat(
        'Owner / principal',
        'Sets policy, approves spend, sees every property and every team member.',
      ),
      {
        key: 'property-manager',
        title: 'Property manager',
        baseRole: 'MEMBER',
        description:
          'Owns a portfolio of doors — tenant comms, renewals, owner reporting.',
        disciplines: ['customer-success', 'operations'],
        routingTags: ['INTAKE', 'TENANT', 'LEASING'],
      },
      {
        key: 'maintenance-coordinator',
        title: 'Maintenance coordinator',
        baseRole: 'MEMBER',
        description:
          'Routes and tracks work orders, dispatches vendors, closes the loop with tenants.',
        disciplines: ['operations'],
        routingTags: ['MAINTENANCE', 'SCHEDULING'],
      },
      adminSeat,
    ],
  },
  {
    vertical: 'LAW',
    label: 'Law firm',
    summary:
      'Partner owns the matter; associates draft; paralegals run the file; an admin handles intake + billing.',
    roles: [
      ownerSeat(
        'Partner',
        'Owns the client relationship and every matter; the final sign-off on legal work.',
      ),
      {
        key: 'associate',
        title: 'Associate',
        baseRole: 'MEMBER',
        description:
          'Drafts and researches under the partner; owns the legal discipline day to day.',
        disciplines: ['legal', 'research'],
        routingTags: ['LEGAL', 'DRAFTING'],
      },
      {
        key: 'paralegal',
        title: 'Paralegal',
        baseRole: 'MEMBER',
        description:
          'Runs the file — intake, document prep, deadlines, and client status.',
        disciplines: ['operations', 'customer-success'],
        routingTags: ['INTAKE', 'DRAFTING', 'SCHEDULING'],
      },
      { ...adminSeat, routingTags: ['BILLING', 'SCHEDULING', 'ADMIN'] },
    ],
  },
  {
    vertical: 'REAL_ESTATE',
    label: 'Real-estate brokerage',
    summary:
      'Broker owns compliance and the brand; agents run their own pipelines.',
    roles: [
      ownerSeat(
        'Broker / owner',
        'Owns compliance, the brand, and the brokerage; sees every agent and every deal.',
      ),
      {
        key: 'agent',
        title: 'Agent',
        baseRole: 'MEMBER',
        description:
          'Runs their own pipeline — leads, showings, and client comms.',
        disciplines: ['sales-enablement', 'customer-success'],
        routingTags: ['INTAKE', 'LEASING', 'MARKETING'],
      },
      {
        key: 'transaction-coordinator',
        title: 'Transaction coordinator',
        baseRole: 'MEMBER',
        description:
          'Shepherds deals to close — paperwork, deadlines, and compliance checks.',
        disciplines: ['operations', 'legal'],
        routingTags: ['DRAFTING', 'SCHEDULING', 'LEGAL'],
      },
      adminSeat,
    ],
  },
  {
    vertical: 'MORTGAGE',
    label: 'Mortgage brokerage',
    summary:
      'Owner-broker sets policy; loan officers own borrowers; processors run the file.',
    roles: [
      ownerSeat(
        'Owner / broker',
        'Owns compliance and the brand; sees every loan and every officer.',
      ),
      {
        key: 'loan-officer',
        title: 'Loan officer',
        baseRole: 'MEMBER',
        description:
          'Owns the borrower relationship — applications, pricing, and status.',
        disciplines: ['sales-enablement', 'customer-success'],
        routingTags: ['INTAKE', 'FINANCE'],
      },
      {
        key: 'processor',
        title: 'Loan processor',
        baseRole: 'MEMBER',
        description:
          'Runs the file to clear-to-close — docs, conditions, and deadlines.',
        disciplines: ['operations'],
        routingTags: ['DRAFTING', 'SCHEDULING'],
      },
      adminSeat,
    ],
  },
  {
    vertical: 'INSURANCE',
    label: 'Insurance agency',
    summary:
      'Principal owns the book; producers write new business; CSRs service policies.',
    roles: [
      ownerSeat(
        'Principal / owner',
        'Owns the book and carrier relationships; sees every account.',
      ),
      {
        key: 'producer',
        title: 'Producer',
        baseRole: 'MEMBER',
        description: 'Writes new business — quotes, binds, and renewals.',
        disciplines: ['sales-enablement', 'customer-success'],
        routingTags: ['INTAKE', 'MARKETING'],
      },
      {
        key: 'csr',
        title: 'Account manager / CSR',
        baseRole: 'MEMBER',
        description:
          'Services the book — endorsements, claims intake, and renewals.',
        disciplines: ['customer-success', 'operations'],
        routingTags: ['INTAKE', 'TENANT', 'SCHEDULING'],
      },
      bookkeeperSeat,
    ],
  },
  {
    vertical: 'TITLE_ESCROW',
    label: 'Title & escrow office',
    summary:
      'Owner signs off; escrow officers run closings; processors clear title.',
    roles: [
      ownerSeat(
        'Owner / escrow principal',
        'Final sign-off on closings; sees every file.',
      ),
      {
        key: 'escrow-officer',
        title: 'Escrow officer',
        baseRole: 'MEMBER',
        description: 'Runs closings — coordination, funds, and signing.',
        disciplines: ['operations', 'customer-success'],
        routingTags: ['SCHEDULING', 'FINANCE', 'INTAKE'],
      },
      {
        key: 'title-processor',
        title: 'Title processor',
        baseRole: 'MEMBER',
        description: 'Clears title — searches, exceptions, and curative work.',
        disciplines: ['operations', 'legal'],
        routingTags: ['DRAFTING', 'LEGAL'],
      },
      adminSeat,
    ],
  },
  {
    vertical: 'RECRUITING',
    label: 'Recruiting / staffing firm',
    summary:
      'Owner sets strategy; recruiters own reqs; a coordinator schedules.',
    roles: [
      ownerSeat(
        'Owner / principal',
        'Sets strategy and owns client relationships; sees every req.',
      ),
      {
        key: 'recruiter',
        title: 'Recruiter',
        baseRole: 'MEMBER',
        description: 'Owns open reqs — sourcing, screening, and submittals.',
        disciplines: ['sales-enablement', 'customer-success'],
        routingTags: ['INTAKE', 'MARKETING'],
      },
      {
        key: 'coordinator',
        title: 'Recruiting coordinator',
        baseRole: 'MEMBER',
        description: 'Schedules interviews and keeps candidates warm.',
        disciplines: ['operations'],
        routingTags: ['SCHEDULING', 'ADMIN'],
      },
      adminSeat,
    ],
  },
  {
    vertical: 'HOME_SERVICES',
    label: 'Home-services / trades',
    summary:
      'Owner runs the business; a dispatcher routes jobs; techs do the work; office handles billing.',
    roles: [
      ownerSeat(
        'Owner',
        'Runs the business — sees every job, every tech, every dollar.',
      ),
      {
        key: 'dispatcher',
        title: 'Dispatcher',
        baseRole: 'MEMBER',
        description:
          'Routes and schedules jobs, balances the board, keeps customers posted.',
        disciplines: ['operations', 'customer-success'],
        routingTags: ['SCHEDULING', 'MAINTENANCE', 'INTAKE'],
      },
      {
        key: 'office-manager',
        title: 'Office manager',
        baseRole: 'ADMIN',
        description:
          'Runs the office — invoicing, follow-ups, and the roster.',
        disciplines: ['finance', 'operations'],
        routingTags: ['BILLING', 'ADMIN'],
      },
    ],
  },
  {
    vertical: 'RIA',
    label: 'Registered investment advisor',
    summary:
      'Principal advisor owns clients; advisors manage relationships; an admin handles ops + compliance prep.',
    roles: [
      ownerSeat(
        'Principal advisor',
        'Owns the firm and fiduciary responsibility; sees every client and every advisor.',
      ),
      {
        key: 'advisor',
        title: 'Advisor',
        baseRole: 'MEMBER',
        description: 'Manages client relationships — reviews, plans, and comms.',
        disciplines: ['customer-success', 'finance'],
        routingTags: ['INTAKE', 'FINANCE'],
      },
      {
        key: 'operations-associate',
        title: 'Operations associate',
        baseRole: 'MEMBER',
        description:
          'Runs back office — onboarding, paperwork, and compliance prep.',
        disciplines: ['operations', 'legal'],
        routingTags: ['DRAFTING', 'SCHEDULING', 'ADMIN'],
      },
    ],
  },
] as const;

/**
 * The GENERAL fallback. Used for workspaces whose vertical has no preset
 * yet, or whose owner wants a blank, configurable shape. Three generic
 * tiers the owner renames to fit.
 */
export const GENERAL_ROLE_PRESET: VerticalRolePreset = {
  vertical: 'REAL_ESTATE', // unused sentinel; resolver keys off null vertical
  label: 'General (configurable)',
  summary:
    'A blank three-tier shape — owner, a manager who configures, and staff who do the work. Rename to fit.',
  roles: [
    ownerSeat('Owner', 'Sees everything; the final word.'),
    {
      key: 'manager',
      title: 'Manager',
      baseRole: 'ADMIN',
      description:
        'Configures the workspace and manages the team; cannot touch billing.',
      disciplines: ['operations'],
      routingTags: ['ADMIN', 'SCHEDULING'],
    },
    {
      key: 'staff',
      title: 'Staff',
      baseRole: 'MEMBER',
      description: 'Does the work and approves within their disciplines.',
      disciplines: [],
      routingTags: ['INTAKE'],
    },
  ],
};

/**
 * Resolve the preset for a vertical. Returns the GENERAL fallback when
 * the vertical is null/unknown or has no preset yet — so callers never
 * have to null-check.
 */
export function getRolePreset(
  vertical: Vertical | null | undefined,
): VerticalRolePreset {
  if (!vertical) return GENERAL_ROLE_PRESET;
  return (
    VERTICAL_ROLE_PRESETS.find((p) => p.vertical === vertical) ??
    GENERAL_ROLE_PRESET
  );
}

/** All vertical presets including GENERAL, for the picker UI + tests. */
export function listRolePresets(): VerticalRolePreset[] {
  return [...VERTICAL_ROLE_PRESETS, GENERAL_ROLE_PRESET];
}

/** Number of distinct verticals with a bespoke (non-GENERAL) preset. */
export function bespokePresetCount(): number {
  return VERTICAL_ROLE_PRESETS.length;
}
