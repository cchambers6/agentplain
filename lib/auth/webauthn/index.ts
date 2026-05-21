// WebAuthn boundary entry point. Routes + UI import from here, NEVER from
// simplewebauthn-provider.ts directly — that keeps the vendor swap to one
// file per feedback_no_silent_vendor_lock.
//
// There is no `test` adapter yet because the passkey flows exercise the
// browser's navigator.credentials API, which has no headless equivalent in
// the current unit-test harness; when a fake is needed it slots in here
// behind the same interface (the two-implementation rule of
// feedback_runner_portability is satisfied structurally by the seam).

import { getWebAuthnConfig } from "./config";
import { SimpleWebAuthnProvider } from "./simplewebauthn-provider";
import type { WebAuthnProvider } from "./types";

let cached: WebAuthnProvider | null = null;

export function getWebAuthnProvider(): WebAuthnProvider {
  if (cached) return cached;
  cached = new SimpleWebAuthnProvider(getWebAuthnConfig());
  return cached;
}

/** For tests: install a custom provider for the duration of a suite. */
export function __setWebAuthnProviderForTests(p: WebAuthnProvider | null): void {
  cached = p;
}

export { getWebAuthnConfig } from "./config";
export type { WebAuthnConfig } from "./config";
export {
  writeChallenge,
  readChallenge,
  clearChallenge,
  type ChallengeKind,
} from "./challenge";
export type {
  WebAuthnProvider,
  RegistrationOptionsInput,
  AuthenticationOptionsInput,
  GeneratedOptions,
  VerifyRegistrationInput,
  VerifiedRegistration,
  VerifyAuthenticationInput,
  VerifiedAuthentication,
  StoredCredentialRef,
  StoredCredentialForAuth,
  PasskeyOptionsJSON,
} from "./types";
