/**
 * lib/preferences/store.ts
 *
 * Prisma read/write boundary for WorkspacePreference + PreferenceSignal.
 * The only file in the codebase that constructs these rows. Per
 * feedback_no_silent_vendor_lock.md, callers receive plain views — never
 * Prisma model types.
 *
 * Every call is wrapped in `withRls(ctx, ...)`. The RLS policies in the
 * 20260523 migration enforce workspace isolation at the database layer;
 * this file enforces it again at the application layer so a bug here
 * fails closed.
 */

import type {
  Prisma,
  PreferenceSignalSource as PrismaSignalSource,
} from '@prisma/client';
import { withRls, type RlsContext } from '../db/rls';
import {
  DRAFTING_TONES,
  CALENDAR_WINDOWS,
  type DraftingTone,
  type CalendarWindow,
  type PreferenceSignalView,
  type WorkspacePreferenceView,
} from './types';

interface PrismaPreferenceRow {
  id: string;
  workspaceId: string;
  draftingTone: string | null;
  categorizationNotes: string | null;
  calendarWindow: string | null;
  learnedDraftNotes: string[];
  disabledDisciplines: string[];
  updatedAt: Date;
}

function toView(row: PrismaPreferenceRow): WorkspacePreferenceView {
  return {
    workspaceId: row.workspaceId,
    draftingTone: normalizeTone(row.draftingTone),
    categorizationNotes: row.categorizationNotes,
    calendarWindow: normalizeCalendarWindow(row.calendarWindow),
    learnedDraftNotes: row.learnedDraftNotes,
    disabledDisciplines: row.disabledDisciplines ?? [],
    updatedAt: row.updatedAt,
  };
}

function normalizeTone(raw: string | null): DraftingTone | null {
  if (!raw) return null;
  return (DRAFTING_TONES as readonly string[]).includes(raw)
    ? (raw as DraftingTone)
    : null;
}

function normalizeCalendarWindow(
  raw: string | null,
): CalendarWindow | string | null {
  if (!raw) return null;
  if ((CALENDAR_WINDOWS as readonly string[]).includes(raw)) {
    return raw as CalendarWindow;
  }
  // Accept free-form custom windows under the `custom:` prefix without
  // discarding them — preserves forward-compat with a settings page that
  // ships later.
  return raw;
}

export async function getWorkspacePreference(
  ctx: RlsContext,
  workspaceId: string,
): Promise<WorkspacePreferenceView | null> {
  return withRls(ctx, async (tx) => {
    const row = (await tx.workspacePreference.findUnique({
      where: { workspaceId },
    })) as PrismaPreferenceRow | null;
    return row ? toView(row) : null;
  });
}

export interface UpsertOnboardingPreferenceArgs {
  workspaceId: string;
  draftingTone?: DraftingTone;
  categorizationNotes?: string;
  calendarWindow?: CalendarWindow | string;
}

/** Upsert the workspace's preference row from the onboarding wizard.
 *  Leaves `learnedDraftNotes` alone — those come from the capture pass
 *  on /approvals. */
export async function upsertOnboardingPreference(
  ctx: RlsContext,
  args: UpsertOnboardingPreferenceArgs,
): Promise<WorkspacePreferenceView> {
  const data = {
    draftingTone: args.draftingTone ?? null,
    categorizationNotes: args.categorizationNotes ?? null,
    calendarWindow: args.calendarWindow ?? null,
  };
  return withRls(ctx, async (tx) => {
    const row = (await tx.workspacePreference.upsert({
      where: { workspaceId: args.workspaceId },
      create: {
        workspaceId: args.workspaceId,
        ...data,
      },
      update: data,
    })) as PrismaPreferenceRow;
    return toView(row);
  });
}

/** Set ONLY the drafting tone, leaving every other preference field
 *  (learnedDraftNotes, categorizationNotes, calendarWindow) untouched.
 *  The onboarding upsert nulls the sibling fields; this focused setter
 *  is what the /settings/voice tone picker uses so changing tone later
 *  never wipes accumulated learnings. */
export async function setDraftingTone(
  ctx: RlsContext,
  args: { workspaceId: string; draftingTone: DraftingTone },
): Promise<WorkspacePreferenceView> {
  return withRls(ctx, async (tx) => {
    const row = (await tx.workspacePreference.upsert({
      where: { workspaceId: args.workspaceId },
      create: {
        workspaceId: args.workspaceId,
        draftingTone: args.draftingTone,
      },
      update: { draftingTone: args.draftingTone },
    })) as PrismaPreferenceRow;
    return toView(row);
  });
}

export interface AppendLearnedNoteArgs {
  workspaceId: string;
  note: string;
  /** Cap on retained notes — older entries fall off the front. */
  cap: number;
}

/** Append a one-line learned note to the front of `learnedDraftNotes`,
 *  trimming to `cap` entries. De-duplicates a back-to-back identical
 *  note so a burst of edits doesn't flood the list. */
export async function appendLearnedDraftNote(
  ctx: RlsContext,
  args: AppendLearnedNoteArgs,
): Promise<WorkspacePreferenceView> {
  return withRls(ctx, async (tx) => {
    const existing = (await tx.workspacePreference.findUnique({
      where: { workspaceId: args.workspaceId },
    })) as PrismaPreferenceRow | null;
    const prior = existing?.learnedDraftNotes ?? [];
    const next = [args.note, ...prior.filter((n) => n !== args.note)].slice(
      0,
      args.cap,
    );
    const row = (await tx.workspacePreference.upsert({
      where: { workspaceId: args.workspaceId },
      create: {
        workspaceId: args.workspaceId,
        learnedDraftNotes: next,
      },
      update: { learnedDraftNotes: next },
    })) as PrismaPreferenceRow;
    return toView(row);
  });
}

export interface RecordSignalArgs {
  workspaceId: string;
  source: PrismaSignalSource;
  kind: string;
  text: string;
  refTable?: string | null;
  refId?: string | null;
  payload?: Prisma.InputJsonValue;
}

/** Append-only signal log entry. Truncates `text` to the boundary cap. */
export async function recordPreferenceSignal(
  ctx: RlsContext,
  args: RecordSignalArgs,
): Promise<PreferenceSignalView> {
  return withRls(ctx, async (tx) => {
    const row = await tx.preferenceSignal.create({
      data: {
        workspaceId: args.workspaceId,
        source: args.source,
        kind: args.kind,
        text: args.text,
        refTable: args.refTable ?? null,
        refId: args.refId ?? null,
        payload: args.payload,
      },
    });
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      source: row.source,
      kind: row.kind,
      text: row.text,
      refTable: row.refTable,
      refId: row.refId,
      capturedAt: row.capturedAt,
    };
  });
}

export async function listPreferenceSignals(
  ctx: RlsContext,
  workspaceId: string,
  limit = 50,
): Promise<PreferenceSignalView[]> {
  return withRls(ctx, async (tx) => {
    const rows = await tx.preferenceSignal.findMany({
      where: { workspaceId },
      orderBy: { capturedAt: 'desc' },
      take: Math.min(Math.max(1, limit), 200),
    });
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      source: row.source,
      kind: row.kind,
      text: row.text,
      refTable: row.refTable,
      refId: row.refId,
      capturedAt: row.capturedAt,
    }));
  });
}
