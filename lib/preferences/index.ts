/**
 * lib/preferences/index.ts
 *
 * Re-export surface. Callers import from `@/lib/preferences` only.
 */

export {
  getWorkspacePreference,
  upsertOnboardingPreference,
  setDraftingTone,
  appendLearnedDraftNote,
  recordPreferenceSignal,
  listPreferenceSignals,
} from './store';

export {
  captureDraftEditSignal,
  captureDraftRejectSignal,
  captureVoiceCorrectionSignal,
  deriveEditNote,
} from './capture';

export { renderPreferencesBlock } from './render';

export {
  DRAFTING_TONES,
  CALENDAR_WINDOWS,
  LEARNED_NOTES_CAP,
  LEARNED_NOTE_MAX_CHARS,
  SIGNAL_TEXT_MAX_CHARS,
  onboardingPreferencesSchema,
} from './types';

export type {
  DraftingTone,
  CalendarWindow,
  OnboardingPreferencesInput,
  WorkspacePreferenceView,
  PreferenceSignalView,
} from './types';
