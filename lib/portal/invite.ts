/**
 * lib/portal/invite.ts
 *
 * Owner-side: invite an end client to the portal. Find-or-create the client
 * identity, mint a single-use magic-link, and email it. The email is sent
 * through agentplain's Resend account for now, branded with the owner's name in
 * the copy; sending from the OWNER's own domain requires per-customer Resend
 * domain config (see TODOS-FOR-CONNER.md) — until then replyTo carries the
 * owner contact when provided so client replies reach the owner, not us.
 */

import { getEmailProvider } from "@/lib/email";
import { findOrCreatePortalClient } from "./clients";
import { createPortalInvite } from "./identity";
import type { PortalBrand } from "./config";

export interface SendInviteArgs {
  brand: PortalBrand;
  appOrigin: string;
  email: string;
  name?: string | null;
  /** Optional owner reply-to so a client's email reply reaches the owner. */
  replyTo?: string | null;
}

export interface SendInviteResult {
  clientId: string;
  inviteUrl: string;
  emailMessageId: string | null;
}

export async function inviteClientToPortal(
  args: SendInviteArgs,
): Promise<SendInviteResult> {
  const client = await findOrCreatePortalClient({
    portalConfigId: args.brand.portalConfigId,
    email: args.email,
    name: args.name,
  });

  const { rawToken } = await createPortalInvite({
    portalConfigId: args.brand.portalConfigId,
    clientId: client.id,
    email: args.email,
  });

  const inviteUrl =
    `${args.appOrigin.replace(/\/$/, "")}/api/portal/${args.brand.slug}/enter` +
    `?token=${encodeURIComponent(rawToken)}`;

  const greetingName = args.name ? `Hi ${args.name},` : "Hi there,";
  const html =
    `<p>${greetingName}</p>` +
    `<p>${escapeHtml(args.brand.brandName)} has set up a secure client portal where you can ` +
    `check the status of your work, share documents, and message the team.</p>` +
    `<p><a href="${inviteUrl}" style="display:inline-block;padding:10px 16px;` +
    `background:${escapeHtml(args.brand.brandColor)};color:#ffffff;border-radius:6px;` +
    `text-decoration:none">Open your portal</a></p>` +
    `<p>This link is personal to you and expires soon. If you didn't expect this, you can ignore it.</p>` +
    `<p>— ${escapeHtml(args.brand.brandName)}</p>`;
  const text =
    `${greetingName}\n\n${args.brand.brandName} has set up a secure client portal for you. ` +
    `Open it here:\n${inviteUrl}\n\nThis link is personal to you and expires soon.\n\n— ${args.brand.brandName}`;

  const provider = getEmailProvider();
  const result = await provider.send({
    to: args.email,
    subject: `${args.brand.brandName}: your client portal is ready`,
    html,
    text,
    replyTo: args.replyTo ?? undefined,
    tags: { category: "portal-invite" },
  });

  return { clientId: client.id, inviteUrl, emailMessageId: result.messageId };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
