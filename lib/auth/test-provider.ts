// In-memory AuthProvider for tests + local development without a Resend key.
// Captured emails accessible via `drainSent()` / `lastSent()`.

import type {
  AuthProvider,
  MagicLinkDeliveryRequest,
  MagicLinkDeliveryResult,
} from "./types";

export interface CapturedMagicLink {
  email: string;
  purpose: string;
  verifyUrl: string;
  displayName: string | null | undefined;
  sentAt: Date;
}

export class TestAuthProvider implements AuthProvider {
  readonly providerName = "test";
  private sent: CapturedMagicLink[] = [];

  async sendMagicLink(
    req: MagicLinkDeliveryRequest,
  ): Promise<MagicLinkDeliveryResult> {
    this.sent.push({
      email: req.email,
      purpose: req.purpose,
      verifyUrl: req.verifyUrl,
      displayName: req.displayName,
      sentAt: new Date(),
    });
    return { messageId: `test_${this.sent.length}` };
  }

  /** Returns and clears the queue. */
  drainSent(): CapturedMagicLink[] {
    const out = this.sent;
    this.sent = [];
    return out;
  }

  /** Last sent message (or undefined). Does not drain. */
  lastSent(): CapturedMagicLink | undefined {
    return this.sent[this.sent.length - 1];
  }

  reset(): void {
    this.sent = [];
  }
}
