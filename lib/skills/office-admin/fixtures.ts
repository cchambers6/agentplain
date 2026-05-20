/**
 * lib/skills/office-admin/fixtures.ts
 *
 * Synthetic email fixtures used by the office-admin tests. One fixture
 * per category — covers every render path the approvals UI needs.
 * Fixtures are deliberately modeled on the real-world emails the
 * task brief calls out (Stripe receipt, Microsoft account-expiration,
 * suspicious-login alert) so the assertions exercise the same shapes
 * the production classifier will see.
 *
 * Per `feedback_no_guesses_no_estimates.md`: every fixture cites the
 * marker that justifies its expected category.
 */

import type { ParsedMessage } from '../types';
import type { OfficeAdminCategory } from './types';

export interface OfficeAdminFixture {
  /** Stable id. */
  id: string;
  /** Short description for test reporting. */
  description: string;
  /** Expected category — asserted by the integration test. */
  expectedCategory: OfficeAdminCategory;
  /** Citation for the expected category. */
  expectedReason: string;
  /** Whether the signals extractor should pull a verification code. */
  expectsVerificationCode?: string;
  /** Whether the signals extractor should pull a primary URL. */
  expectsPrimaryUrl?: boolean;
  /** The synthetic message. */
  message: ParsedMessage;
}

function msg(partial: {
  id: string;
  fromEmail: string;
  fromName?: string;
  subject: string;
  bodyText: string;
  receivedAt?: string;
}): ParsedMessage {
  return {
    id: partial.id,
    threadId: `thr-${partial.id}`,
    rfcMessageId: `<${partial.id}@mail.example.com>`,
    fromEmail: partial.fromEmail,
    fromName: partial.fromName ?? null,
    toEmails: ['operator@example.com'],
    ccEmails: [],
    subject: partial.subject,
    bodyText: partial.bodyText,
    snippet: partial.bodyText.slice(0, 200),
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date(partial.receivedAt ?? '2026-05-19T14:00:00.000Z'),
    labels: ['INBOX', 'UNREAD'],
  };
}

export const OFFICE_ADMIN_FIXTURES: OfficeAdminFixture[] = [
  {
    id: 'verify-email-signup',
    description: 'Stripe-style email-verification request.',
    expectedCategory: 'email-verification',
    expectedReason: 'classifier: explicit "verify your email" + dedicated link',
    expectsPrimaryUrl: true,
    message: msg({
      id: 'verify-email-signup',
      fromEmail: 'no-reply@stripe.com',
      fromName: 'Stripe',
      subject: 'Please verify your email address',
      bodyText:
        'Hi there,\n\nTo complete your Stripe sign-up, please verify your email address by clicking the link below.\n\nhttps://dashboard.stripe.com/verify/abcdefghi123\n\nThis link will expire in 24 hours.\n\nThanks,\nThe Stripe team',
    }),
  },
  {
    id: 'verification-code-google',
    description: 'Google sign-in 6-digit code.',
    expectedCategory: 'verification-code',
    expectedReason: 'classifier: 6-digit one-time code + "your verification code is" marker',
    expectsVerificationCode: '482915',
    message: msg({
      id: 'verification-code-google',
      fromEmail: 'no-reply@accounts.google.com',
      fromName: 'Google',
      subject: 'Your Google verification code is 482915',
      bodyText:
        'Your Google verification code is 482915. Do not share this code with anyone. If you did not request this code, ignore this message.\n\nGoogle Account team',
    }),
  },
  {
    id: 'password-reset-github',
    description: 'GitHub password-reset link.',
    expectedCategory: 'password-reset',
    expectedReason: 'classifier: explicit "reset your password" + dedicated link',
    expectsPrimaryUrl: true,
    message: msg({
      id: 'password-reset-github',
      fromEmail: 'noreply@github.com',
      fromName: 'GitHub',
      subject: 'Password reset request',
      bodyText:
        'A request to reset your password was made for your GitHub account.\n\nClick the link below within the next hour to set a new password:\n\nhttps://github.com/password_reset/eyJtb2tlbiI6Im1vY2sifQ\n\nIf you did not request this, you can ignore this email.\n\nThanks,\nThe GitHub Team',
    }),
  },
  {
    id: 'trial-expiration-microsoft',
    description: 'Microsoft account / trial-ending warning.',
    expectedCategory: 'trial-expiration',
    expectedReason: 'classifier: "subscription will expire" + named end date',
    message: msg({
      id: 'trial-expiration-microsoft',
      fromEmail: 'account-notifications@microsoft.com',
      fromName: 'Microsoft account team',
      subject: 'Your Microsoft 365 trial ends in 3 days',
      bodyText:
        'Hi,\n\nYour Microsoft 365 Business Standard trial subscription will expire in 3 days. After expiration your account will lose access to premium features. You will be charged $22.00 USD when the subscription renews unless you cancel before May 22.\n\nManage your subscription at https://account.microsoft.com/subscriptions.\n\nThanks,\nThe Microsoft account team',
    }),
  },
  {
    id: 'billing-notice-stripe-receipt',
    description: 'Stripe payment receipt for a subscription charge.',
    expectedCategory: 'billing-notice',
    expectedReason: 'classifier: invoice + payment receipt language with line items',
    message: msg({
      id: 'billing-notice-stripe-receipt',
      fromEmail: 'invoice+receipts@stripe.com',
      fromName: 'Stripe',
      subject: 'Receipt for your payment to Vercel — invoice #ACCT-2026-05',
      bodyText:
        'Receipt for your payment to Vercel\n\nInvoice number: ACCT-2026-05\nAmount paid: $20.00 USD\n\nThank you for your payment. Your invoice has been paid in full. View the full invoice at https://invoice.stripe.com/i/abc.',
    }),
  },
  {
    id: 'subscription-confirmation-notion',
    description: 'Notion subscription activation welcome.',
    expectedCategory: 'subscription-confirmation',
    expectedReason: 'classifier: "your subscription is active" + welcome framing',
    message: msg({
      id: 'subscription-confirmation-notion',
      fromEmail: 'team@notion.so',
      fromName: 'Notion',
      subject: 'Welcome to Notion Plus — your subscription is active',
      bodyText:
        'Welcome to Notion Plus!\n\nYour subscription is active and your workspace now has access to unlimited file uploads, version history, and admin tools. Your next invoice will be issued on June 19.\n\nThanks for upgrading,\nThe Notion team',
    }),
  },
  {
    id: 'service-status-aws',
    description: 'AWS scheduled maintenance notice.',
    expectedCategory: 'service-status',
    expectedReason: 'classifier: scheduled-maintenance language with named service',
    message: msg({
      id: 'service-status-aws',
      fromEmail: 'no-reply-aws@amazon.com',
      fromName: 'AWS Notifications',
      subject: 'AWS scheduled maintenance — us-east-1 RDS instances',
      bodyText:
        'We are writing to let you know about a scheduled maintenance window for RDS instances in the us-east-1 region. Service disruption is expected from 2026-05-22 02:00 UTC to 2026-05-22 04:00 UTC. No action is required on your part.\n\nThanks,\nAWS Notifications',
    }),
  },
  {
    id: 'account-suspension-chase',
    description: 'Suspicious-login alert from a bank.',
    expectedCategory: 'account-suspension',
    expectedReason: 'classifier: "suspicious sign-in" + new device + security alert',
    message: msg({
      id: 'account-suspension-chase',
      fromEmail: 'security-alerts@chase.com',
      fromName: 'Chase Security',
      subject: 'Security alert — new sign-in detected',
      bodyText:
        'We detected a new sign-in to your Chase account from a new device. If this was you, no action is needed. If this was not you, please contact security immediately. This is a security alert about suspicious sign-in activity.',
    }),
  },
  {
    id: 'email-preferences-mailchimp',
    description: 'Email-preferences housekeeping update.',
    expectedCategory: 'email-preferences',
    expectedReason: 'classifier: "manage email preferences" + unsubscribe language',
    message: msg({
      id: 'email-preferences-mailchimp',
      fromEmail: 'updates@mailchimp.com',
      fromName: 'Mailchimp',
      subject: 'Update your email preferences',
      bodyText:
        'We are updating our email program. Please take a moment to update your email preferences or unsubscribe at https://mailchimp.com/preferences/abc. We will continue to send transactional emails regardless of your preference selections.',
    }),
  },
  {
    id: 'not-admin-lead-inquiry',
    description: 'Real lead inquiry — must NOT classify as admin.',
    expectedCategory: 'not-admin',
    expectedReason: 'classifier: lead-shaped inquiry; nothing admin-flavored beyond the word "verify" used loosely',
    message: msg({
      id: 'not-admin-lead-inquiry',
      fromEmail: 'sarah.buyer@gmail.com',
      fromName: 'Sarah Buyer',
      subject: '1247 Magnolia Dr — interested',
      bodyText:
        'Hi — I saw the listing at 1247 Magnolia Dr and I am interested. Can you please send the disclosures and let me know what the price flexibility looks like? Want to verify whether the property is still on the market.',
    }),
  },
];

export function getFixture(id: string): OfficeAdminFixture {
  const found = OFFICE_ADMIN_FIXTURES.find((f) => f.id === id);
  if (!found) throw new Error(`office-admin fixture not found: ${id}`);
  return found;
}
