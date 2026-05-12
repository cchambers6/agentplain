// Email boundary entry point. One swap point. Mirrors lib/auth/ and
// lib/billing/ shapes (feedback_no_silent_vendor_lock).

import { env } from "../env";
import { ResendEmailProvider } from "./resend-provider";
import { TestEmailProvider } from "./test-provider";
import type { EmailProvider } from "./types";

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  // Reuse the auth-tier selection — the auth flow already gates on
  // AUTH_PROVIDER, and the same Resend account services both.
  switch (env.authProvider()) {
    case "test":
      cached = new TestEmailProvider();
      break;
    case "resend":
    default:
      cached = new ResendEmailProvider({
        apiKey: env.resendApiKey(),
        fromEmail: env.resendFromEmail(),
      });
      break;
  }
  return cached;
}

export function __setEmailProviderForTests(p: EmailProvider | null): void {
  cached = p;
}

export type { EmailProvider, SendEmailRequest, SendEmailResult } from "./types";
export { TestEmailProvider } from "./test-provider";
export { ResendEmailProvider } from "./resend-provider";
