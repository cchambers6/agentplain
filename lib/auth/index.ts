// Auth boundary entry point. Domain code imports from here, NEVER from
// resend-provider.ts or test-provider.ts directly — that keeps the swap
// to one file (this one) per feedback_no_silent_vendor_lock.

import { env } from "../env";
import { ResendAuthProvider } from "./resend-provider";
import { TestAuthProvider } from "./test-provider";
import type { AuthProvider } from "./types";

let cached: AuthProvider | null = null;

export function getAuthProvider(): AuthProvider {
  if (cached) return cached;
  switch (env.authProvider()) {
    case "test":
      cached = new TestAuthProvider();
      break;
    case "resend":
    default:
      cached = new ResendAuthProvider({
        apiKey: env.resendApiKey(),
        fromEmail: env.resendFromEmail(),
      });
      break;
  }
  return cached;
}

/** For tests: install a custom provider for the duration of a suite. */
export function __setAuthProviderForTests(p: AuthProvider | null): void {
  cached = p;
}

export type {
  AuthProvider,
  MagicLinkDeliveryRequest,
  MagicLinkPurpose,
} from "./types";
export { TestAuthProvider } from "./test-provider";
export { ResendAuthProvider } from "./resend-provider";
export {
  generateRawToken,
  hashToken,
  tokenExpiresAt,
  MAGIC_LINK_TTL_MINUTES,
} from "./token";
export {
  readSession,
  writeSession,
  clearSession,
  type SessionPayload,
} from "./session";
export {
  signUpBrokerOwner,
  requestMagicLink,
  verifyMagicLink,
  type SignUpInput,
  type SignUpResult,
  type RequestMagicLinkInput,
  type RequestMagicLinkResult,
  type VerifyMagicLinkInput,
  type VerifyMagicLinkResult,
} from "./flows";
export {
  getCurrentSession,
  requireUser,
  requireWorkspaceMember,
  defaultWorkspaceIdFor,
  type AuthorizedSession,
  type MembershipAssertion,
} from "./server";
