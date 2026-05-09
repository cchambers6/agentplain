// Resend-backed AuthProvider. Sends magic-link emails via the Resend API.
// All Resend SDK access is contained in this file per feedback_no_silent_vendor_lock.

import { Resend } from "resend";
import type {
  AuthProvider,
  MagicLinkDeliveryRequest,
  MagicLinkDeliveryResult,
} from "./types";

const SUBJECT_BY_PURPOSE: Record<string, string> = {
  sign_in: "Your agentplain sign-in link",
  sign_up: "Welcome to agentplain — finish creating your workspace",
  invite_accept: "You've been invited to an agentplain workspace",
};

const renderHtml = (req: MagicLinkDeliveryRequest): string => {
  const greeting = req.displayName ? `Hi ${req.displayName},` : "Hello,";
  const cta =
    req.purpose === "sign_up"
      ? "Finish setting up your workspace"
      : req.purpose === "invite_accept"
        ? "Accept your invitation"
        : "Sign in to agentplain";
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif; color:#2A2620; background:#F4EEE3; padding:32px;">
  <p>${greeting}</p>
  <p>${cta} by clicking the link below. This link expires in 15 minutes and can only be used once.</p>
  <p><a href="${req.verifyUrl}" style="display:inline-block; padding:12px 20px; background:#2A2620; color:#F4EEE3; text-decoration:none; font-weight:500;">${cta}</a></p>
  <p style="font-size:13px; color:#5A5D62;">If you didn't request this, ignore the email — nothing happens unless you click.</p>
  <p style="font-size:13px; color:#5A5D62;">— agentplain</p>
</body></html>`;
};

const renderText = (req: MagicLinkDeliveryRequest): string => {
  const cta =
    req.purpose === "sign_up"
      ? "Finish setting up your workspace"
      : req.purpose === "invite_accept"
        ? "Accept your invitation"
        : "Sign in to agentplain";
  return `${cta}: ${req.verifyUrl}\n\nThis link expires in 15 minutes and can only be used once.\nIf you didn't request this, ignore the email.\n\n— agentplain`;
};

type ResendEmails = Pick<InstanceType<typeof Resend>["emails"], "send">;

export interface ResendProviderOptions {
  apiKey: string;
  fromEmail: string;
  /** Override for tests — receives the same arguments Resend.emails.send would. */
  client?: ResendEmails;
}

export class ResendAuthProvider implements AuthProvider {
  readonly providerName = "resend";
  private readonly client: ResendEmails;
  private readonly fromEmail: string;

  constructor(opts: ResendProviderOptions) {
    this.fromEmail = opts.fromEmail;
    this.client = opts.client ?? new Resend(opts.apiKey).emails;
  }

  async sendMagicLink(
    req: MagicLinkDeliveryRequest,
  ): Promise<MagicLinkDeliveryResult> {
    const result = await this.client.send({
      from: this.fromEmail,
      to: req.email,
      subject: SUBJECT_BY_PURPOSE[req.purpose] ?? SUBJECT_BY_PURPOSE.sign_in,
      html: renderHtml(req),
      text: renderText(req),
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
