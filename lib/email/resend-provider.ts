// Resend-backed EmailProvider for general transactional mail (billing
// warnings, etc.). Auth magic-link emails live in `lib/auth/resend-provider`
// for purpose-specific subject/render reasons.

import { Resend } from "resend";
import type { EmailProvider, SendEmailRequest, SendEmailResult } from "./types";

type ResendEmails = Pick<InstanceType<typeof Resend>["emails"], "send">;

export interface ResendEmailProviderOptions {
  apiKey: string;
  fromEmail: string;
  /** Override for tests — receives the same arguments Resend.emails.send would. */
  client?: ResendEmails;
}

export class ResendEmailProvider implements EmailProvider {
  readonly providerName = "resend";
  private readonly client: ResendEmails;
  private readonly fromEmail: string;

  constructor(opts: ResendEmailProviderOptions) {
    this.fromEmail = opts.fromEmail;
    this.client = opts.client ?? new Resend(opts.apiKey).emails;
  }

  async send(req: SendEmailRequest): Promise<SendEmailResult> {
    const result = await this.client.send({
      from: this.fromEmail,
      to: req.to,
      subject: req.subject,
      html: req.html,
      text: req.text,
      ...(req.replyTo ? { replyTo: req.replyTo } : {}),
      ...(req.tags
        ? {
            tags: Object.entries(req.tags).map(([name, value]) => ({
              name,
              value,
            })),
          }
        : {}),
    });
    if ("error" in result && result.error) {
      throw new Error(
        `Resend send failed: ${result.error.message ?? String(result.error)}`,
      );
    }
    return {
      messageId: ("data" in result && result.data?.id) || null,
    };
  }
}
