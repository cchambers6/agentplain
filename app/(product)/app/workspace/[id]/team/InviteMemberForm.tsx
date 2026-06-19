"use client";

/**
 * InviteMemberForm — manager+ affordance to invite a teammate.
 * Picks email, optional name, and a role. ADMIN inviters can only assign
 * MEMBER / VIEWER; OWNER inviters can also assign ADMIN / OWNER.
 */

import { useState } from "react";
import { inviteMember } from "./actions";

interface Props {
  workspaceId: string;
  /** True when the inviter may assign ADMIN/OWNER seats. */
  canInviteAdmin: boolean;
}

export function InviteMemberForm({ workspaceId, canInviteAdmin }: Props): JSX.Element {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"OWNER" | "ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOk(false);
    const result = await inviteMember({
      workspaceId,
      email: email.trim(),
      name: name.trim() || undefined,
      role,
    });
    setSubmitting(false);
    if (result.ok) {
      setOk(true);
      setEmail("");
      setName("");
      setRole("MEMBER");
    } else {
      setError(result.error ?? "Could not send the invite.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          email
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="mt-1 w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
          placeholder="teammate@yourcompany.com"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          name (optional)
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          className="mt-1 w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
          placeholder="Jane Doe"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          role
        </span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          disabled={submitting}
          className="mt-1 w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
        >
          <option value="VIEWER">Viewer — read-only</option>
          <option value="MEMBER">Staff — does the work</option>
          {canInviteAdmin ? (
            <>
              <option value="ADMIN">Manager — configures + manages team</option>
              <option value="OWNER">Owner — full access incl. billing</option>
            </>
          ) : null}
        </select>
      </label>
      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className="rounded-none bg-ink px-4 py-2 text-[13px] text-paper disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send invite"}
      </button>
      {ok ? (
        <p className="text-[12px] text-ink-soft" role="status">
          Invite recorded. They&apos;ll join once they accept.
        </p>
      ) : null}
      {error ? (
        <p className="text-[12px] text-flag" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
