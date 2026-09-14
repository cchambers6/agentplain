/**
 * Re-export shim.
 *
 * The predicate moved to `lib/verticals/live-requires.ts` so that
 * `tests/agent-roster-live-requires.test.ts` can import the REAL function
 * instead of the hand-copied second implementation it used to carry. A
 * test that re-implements its subject stays green no matter what the
 * subject does; that is not a test, it is a mirror.
 *
 * This file stays so existing imports keep working.
 */

export {
  connectPrompt,
  formatConnectors,
  liveRequiresSatisfied,
  needsCapabilityReconnect,
  requiredCapability,
  type RosterCapability,
} from "@/lib/verticals/live-requires";
