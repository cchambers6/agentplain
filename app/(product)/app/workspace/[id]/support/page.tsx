import { requireWorkspaceMember } from "@/lib/auth/server";
import { withRls } from "@/lib/db/rls";
import PlainoSupportChat from "@/components/support/PlainoSupportChat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

// In-app support chat. Thin loader: assert membership, resolve the workspace
// name for Plaino's greeting, then hand off to the client chat component. The
// chat talks to /api/chat (mode=support) and can draft a SupportRequest into
// the operator review queue via /api/support/draft. The form-based /help
// surface stays available as the non-conversational fallback.
export default async function SupportChatPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const workspace = await withRls(
    { userId: member.userId, workspaceId, isOperator: member.isOperator },
    (tx) =>
      tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
  );

  return (
    <PlainoSupportChat
      workspaceId={workspaceId}
      workspaceName={workspace?.name ?? "your workspace"}
    />
  );
}
