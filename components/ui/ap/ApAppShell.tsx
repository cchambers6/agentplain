import type { ReactNode } from "react";
import Logo from "@/components/brand/Logo";

// Product chrome — header (56px, paper, hairline) + main + footer (40px,
// paper, hairline). No sidebar. Per design language §3.1.
//
// The header carries the agentplain wordmark on the left and optional account
// chip on the right. The workspace strip (workspace name + horizontal nav +
// member email + sign-out) is a separate primitive composed inside `<main>`
// — see `ApWorkspaceStrip` below.
//
// Banned variants per §3.1: left sidebar, top-bar with global search +
// avatar dropdown, command-palette trigger in chrome, floating help bubble.

interface ApAppShellProps {
  /** Right-rail of the header. Typically a member email + sign-out form, or null
   *  on sign-in / sign-up surfaces. */
  headerRight?: ReactNode;
  /** Page body. `(product)/layout.tsx` passes route children. */
  children: ReactNode;
  /** Footer right-rail override (defaults to the current year). */
  footerRight?: ReactNode;
}

/**
 * @example
 * <ApAppShell headerRight={<MemberChip member={member} />}>
 *   <ApWorkspaceStrip ... />
 *   {children}
 * </ApAppShell>
 *
 * @example
 * // sign-in / sign-up surface — no member chip
 * <ApAppShell>{children}</ApAppShell>
 */
export function ApAppShell({
  headerRight,
  children,
  footerRight,
}: ApAppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-rule bg-paper">
        <div className="container-wide flex h-14 items-center justify-between">
          <Logo size="sm" />
          {headerRight ? (
            <div className="flex items-center gap-3 text-[11px] font-mono tracking-wide uppercase text-mute">
              {headerRight}
            </div>
          ) : null}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-rule">
        <div className="container-wide flex h-10 items-center justify-between text-[11px] font-mono tracking-wide text-mute">
          <Logo size="sm" asLink={false} />
          <span>{footerRight ?? new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

// ApWorkspaceStrip — the workspace context band that sits directly under the
// header on every authenticated workspace surface. Eyebrow (slug) + display
// (workspace name) + horizontal nav. Member info + sign-out rendered into the
// header via `ApAppShell.headerRight` instead — the strip itself stays focused
// on workspace context.

interface ApWorkspaceStripProps {
  /** Workspace slug — rendered as mono eyebrow. */
  slug: string;
  /** Workspace name — rendered as display-serif. */
  name: string;
  /** Optional right-rail content (e.g. workspace role chip). */
  right?: ReactNode;
  /** Horizontal nav. Caller composes <ApWorkspaceNavLink> per route. */
  nav?: ReactNode;
}

export function ApWorkspaceStrip({
  slug,
  name,
  right,
  nav,
}: ApWorkspaceStripProps) {
  return (
    <div className="border-b border-rule bg-paper-deep">
      <div className="container-wide flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {slug}
          </p>
          <p className="font-display text-2xl text-ink">{name}</p>
        </div>
        {right ? (
          <div className="flex items-center gap-3 text-[11px] font-mono tracking-wide uppercase text-mute">
            {right}
          </div>
        ) : null}
      </div>
      {nav ? (
        <nav className="container-wide flex gap-5 overflow-x-auto pb-3 text-sm">
          {nav}
        </nav>
      ) : null}
    </div>
  );
}
