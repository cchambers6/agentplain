// Push provider selection — the vendor swap point.
//
// Kept in its own module (not the barrel) so notify.ts can depend on it
// without a barrel import cycle. Domain code can import getPushProvider from
// either here or the lib/push barrel.

import { ExpoPushProvider } from "./expo-provider";
import type { PushProvider } from "./types";

let cached: PushProvider | null = null;

export function getPushProvider(): PushProvider {
  if (cached) return cached;
  cached = new ExpoPushProvider();
  return cached;
}

/** For tests: install a custom provider for the duration of a suite. */
export function __setPushProviderForTests(p: PushProvider | null): void {
  cached = p;
}
