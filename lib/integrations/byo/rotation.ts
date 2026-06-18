/**
 * lib/integrations/byo/rotation.ts
 *
 * Key-rotation reminders for Customer-Brought, API-key connections.
 *
 * OAuth credentials auto-refresh, so they never need a manual rotation nudge.
 * But API-key connectors (Follow Up Boss, Sierra, Buildium, TaxDome, Karbon)
 * hold a long-lived secret the customer pasted in — security hygiene says
 * rotate it every 90 days. This module computes, purely, which credentials are
 * due so the owner can be emailed.
 *
 * Pure functions only — the caller walks `IntegrationCredential` rows and the
 * email send happens at the existing notification seam.
 */

import { getMarketplaceEntry } from '../marketplace';
import type {
  ByoCredentialView,
  RotationReminder,
  RotationStatus,
} from './types';

/** Rotate an API key every 90 days. */
export const ROTATION_INTERVAL_DAYS = 90;

/** Warn the owner this many days before the 90-day mark. */
export const ROTATION_WARN_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days between two instants (a − b), floored. */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/**
 * The instant a credential's rotation clock starts: its last successful
 * refresh if it has one, else its creation time. For API-key credentials
 * `lastRefreshedAt` is set when the customer re-pastes a fresh key, so this
 * naturally resets the clock on rotation.
 */
function rotationAnchor(cred: ByoCredentialView): Date {
  return cred.lastRefreshedAt ?? cred.createdAt;
}

/**
 * Whether a credential needs manual rotation reminders at all. Only API-key
 * connectors do — OAuth refreshes itself. We resolve `connectMode` from the
 * marketplace entry for the credential's connector.
 */
export function needsRotationReminder(integrationId: string): boolean {
  const entry = getMarketplaceEntry(integrationId);
  return entry?.connectMode === 'api-key';
}

/** Map a day-delta to the 90-day rotation point onto a status. */
export function rotationStatusFor(dueInDays: number): RotationStatus {
  if (dueInDays <= 0) return 'overdue';
  if (dueInDays <= ROTATION_WARN_DAYS) return 'due-soon';
  return 'ok';
}

/**
 * Build a rotation reminder for one API-key credential. Returns null for OAuth
 * connectors (no manual rotation) or unknown connectors.
 */
export function rotationReminderFor(
  integrationId: string,
  cred: ByoCredentialView,
  now: Date,
): RotationReminder | null {
  if (!needsRotationReminder(integrationId)) return null;
  const ageDays = daysBetween(now, rotationAnchor(cred));
  const dueInDays = ROTATION_INTERVAL_DAYS - ageDays;
  return {
    integrationId,
    provider: cred.provider,
    accountEmail: cred.accountEmail,
    ageDays,
    dueInDays,
    status: rotationStatusFor(dueInDays),
  };
}

/**
 * From a set of (integrationId, credential) pairs, the reminders that should
 * be EMAILED now: API-key credentials that are due-soon or overdue. OAuth
 * credentials and not-yet-due keys are filtered out.
 */
export function rotationRemindersDue(
  creds: ReadonlyArray<{ integrationId: string; cred: ByoCredentialView }>,
  now: Date,
): RotationReminder[] {
  const out: RotationReminder[] = [];
  for (const { integrationId, cred } of creds) {
    if (cred.status !== 'ACTIVE') continue; // don't nag revoked/expired keys
    const reminder = rotationReminderFor(integrationId, cred, now);
    if (reminder && reminder.status !== 'ok') out.push(reminder);
  }
  // Most-overdue first.
  return out.sort((a, b) => a.dueInDays - b.dueInDays);
}
