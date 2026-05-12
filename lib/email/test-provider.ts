// In-memory EmailProvider for tests + preview without Resend.
// Records every sent message on `sent` so tests can assert on content.

import type { EmailProvider, SendEmailRequest, SendEmailResult } from "./types";

export class TestEmailProvider implements EmailProvider {
  readonly providerName = "test";
  readonly sent: SendEmailRequest[] = [];
  private nextId = 1;

  async send(req: SendEmailRequest): Promise<SendEmailResult> {
    this.sent.push(req);
    return { messageId: `email_test_${this.nextId++}` };
  }
}
