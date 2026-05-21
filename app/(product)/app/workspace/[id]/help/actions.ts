"use server";

import { requireWorkspaceMember } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { submitSupportRequest } from "@/lib/support";
import type { SupportRequestInput } from "@/lib/support";

export interface SupportActionResult {
  ok: boolean;
  notice?: string;
  formError?: string;
  fieldErrors?: Partial<Record<keyof SupportRequestInput, string>>;
}

const formString = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

// workspaceId is bound by the page so the action can re-assert membership
// before resolving the sender + workspace name.
export async function sendSupportMessageAction(
  workspaceId: string,
  _prev: SupportActionResult | undefined,
  form: FormData,
): Promise<SupportActionResult> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
  );

  const result = await submitSupportRequest({
    raw: {
      subject: formString(form, "subject"),
      body: formString(form, "body"),
    },
    workspaceId,
    fromUserId: member.userId,
    fromEmail: member.email,
    workspaceName: workspace?.name ?? "your workspace",
    partnerName: servicePartnerForWorkspace(workspaceId),
  });

  if (!result.ok) {
    return {
      ok: false,
      formError: result.formError,
      fieldErrors: result.fieldErrors,
    };
  }

  return {
    ok: true,
    notice:
      "Your message is on its way to your service partner. We'll follow up by email.",
  };
}
