"use client";

/**
 * MemberRoleControl — inline role selector + remove for one roster row.
 * Rendered only for managers (canPerform roster.write) and never for the
 * viewer's own row. ADMIN managers cannot set ADMIN/OWNER seats — those
 * options are hidden unless `canManageOwner`.
 */

import { useState } from "react";
import type { Role } from "@prisma/client";
import { asRoleTier, RoleTier } from "@/lib/auth/roles";
import { setMemberRole, removeMember } from "./actions";

interface Props {
  workspaceId: string;
  userId: string;
  currentRole: Role;
  /** True when the actor may manage ADMIN/OWNER seats. */
  canManageOwner: boolean;
}

// Normalize legacy roles to the canonical enum value the select shows.
function canonicalRole(role: Role): "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" {
  switch (asRoleTier(role)) {
    case RoleTier.OWNER:
      return "OWNER";
    case RoleTier.ADMIN:
      return "ADMIN";
    case RoleTier.MEMBER:
      return "MEMBER";
    default:
      return "VIEWER";
  }
}

export function MemberRoleControl({
  workspaceId,
  userId,
  currentRole,
  canManageOwner,
}: Props): JSX.Element {
  const [role, setRole] = useState(canonicalRole(currentRole));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = role !== canonicalRole(currentRole);

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const result = await setMemberRole({ workspaceId, userId, role });
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Could not change role.");
  };

  const remove = async (): Promise<void> => {
    if (!confirm("Remove this member from the workspace?")) return;
    setBusy(true);
    setError(null);
    const result = await removeMember({ workspaceId, userId });
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Could not remove member.");
  };

  // An ADMIN manager can't touch an OWNER/ADMIN seat at all.
  const targetIsHigh = asRoleTier(currentRole) >= RoleTier.ADMIN;
  const locked = targetIsHigh && !canManageOwner;

  if (locked) {
    return <span className="text-mute">{role.toLowerCase()}</span>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          disabled={busy}
          className="rounded-none border border-rule bg-paper px-2 py-1 text-[13px] text-ink"
          aria-label="Member role"
        >
          <option value="VIEWER">Viewer</option>
          <option value="MEMBER">Staff</option>
          {canManageOwner ? (
            <>
              <option value="ADMIN">Manager</option>
              <option value="OWNER">Owner</option>
            </>
          ) : null}
        </select>
        {dirty ? (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-none bg-ink px-3 py-1 text-[12px] text-paper disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        ) : (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-none border border-rule px-3 py-1 text-[12px] text-ink-soft hover:text-flag disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      {error ? (
        <p className="text-[12px] text-flag" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
