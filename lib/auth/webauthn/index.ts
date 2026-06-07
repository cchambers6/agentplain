// WebAuthn boundary entry point. Routes + UI import from here, NEVER from
// simplewebauthn-provider.ts directly — that keeps the vendor swap to one
// file per feedback_no_silent_vendor_lock.
//
// There is no `test` adapter yet because the passkey flows exercise the
// browser's navigator.credentials API, which has no headless equivalent in
// the current unit-test harness; when a fake is needed it slots in here
// behind the same interface (the two-implementation rule of
// feedback_runner_portability is satisfied structurally by the seam).

import {
  getWebAuthnConfig,
  getWebAuthnConfigForRequest,
  type RequestOriginInfo,
} from "./config";
import { SimpleWebAuthnProvider } from "./simplewebauthn-provider";
import type { WebAuthnProvider } from "./types";

let cached: WebAuthnProvider | null = null;

export function getWebAuthnProvider(): WebAuthnProvider {
  if (cached) return cached;
  cached = new SimpleWebAuthnProvider(getWebAuthnConfig());
  return cached;
}

/**
 * Request-scoped provider. Built fresh per call because rpID + expectedOrigins
 * vary with the host the request is served on (apex vs app vs preview vs
 * localhost) — a cached singleton would pin them to one host. Routes use this;
 * the cached getWebAuthnProvider() remains for tests + non-request callers.
 * When a custom provider is installed via __setWebAuthnProviderForTests it
 * wins, so suites that fake the provider keep working through the request path.
 */
export function getWebAuthnProviderForRequest(
  req: RequestOriginInfo,
): WebAuthnProvider {
  if (cached) return cached;
  return new SimpleWebAuthnProvider(getWebAuthnConfigForRequest(req));
}

/** For tests: install a custom provider for the duration of a suite. */
export function __setWebAuthnProviderForTests(p: WebAuthnProvider | null): void {
  cached = p;
}

export {
  getWebAuthnConfig,
  getWebAuthnConfigForRequest,
  resolveRpId,
  type RequestOriginInfo,
} from "./config";
export type { WebAuthnConfig } from "./config";
export { requestOriginInfo } from "./request";
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
