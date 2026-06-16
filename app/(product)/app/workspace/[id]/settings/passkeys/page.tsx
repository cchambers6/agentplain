import Link from "next/link";
import { ApEyebrow } from "@/components/ui/ap";
import { listPasskeys } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { PasskeyNudge } from "@/components/auth/PasskeyNudge";
import { PasskeysManager } from "./PasskeysManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PasskeysSettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const passkeys = await listPasskeys(member.userId);
  const hasPasskey = passkeys.length > 0;

  return (
    <div>
      <ApEyebrow className="mb-3">sign-in &amp; security</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">Passkeys</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        A passkey lets you sign in with your device&rsquo;s fingerprint, face,
        or screen lock — faster than an email link, and nothing to remember.
        Your email link still works as a fallback.
      </p>

      {!hasPasskey ? (
        <div className="mt-6 max-w-2xl">
          <PasskeyNudge workspaceId={workspaceId} variant="inline" />
        </div>
      ) : null}

      <div className="mt-8 max-w-2xl">
        <PasskeysManager workspaceId={workspaceId} passkeys={passkeys} />
      </div>

      <p className="mt-10 max-w-2xl border-t border-rule pt-6 text-[13px] leading-relaxed text-mute">
        <Link
          href={`/app/workspace/${workspaceId}/settings`}
          className="text-ink underline"
        >
          ← back to settings
        </Link>
      </p>
    </div>
  );
}
