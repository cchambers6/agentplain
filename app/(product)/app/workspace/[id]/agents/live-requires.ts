import type { AgentRosterEntry } from "@/lib/verticals/types";

/**
 * Render-time precondition check for `liveRequires`. A roster card with
 * `runtime: "live"` AND a `liveRequires.connectors` list is HONESTLY live
 * only when at least one of the listed connectors is ACTIVE for the
 * workspace. With no active connector, the card degrades to "connect to
 * activate" instead of a stale "live" badge.
 */
export function liveRequiresSatisfied(
  agent: AgentRosterEntry,
  activeConnectors: ReadonlySet<string>,
): boolean {
  const required = agent.liveRequires?.connectors;
  if (!required || required.length === 0) return true;
  return required.some((c) => activeConnectors.has(c));
}

/**
 * Map `liveRequires.connectors` provider keys (which mirror
 * `IntegrationCredential.provider`) to the marketplace tile names a
 * customer recognizes. Falls back to the raw key when no mapping
 * exists so a new connector key doesn't render as blank.
 */
export function formatConnectors(connectors: string[]): string {
  if (connectors.length === 0) return "a connector";
  const labels = connectors.map((c) => {
    switch (c) {
      case "GOOGLE":
        return "Google Calendar";
      case "M365":
        return "Outlook Calendar";
      case "QUICKBOOKS":
        return "QuickBooks";
      case "DOCUSIGN":
        return "DocuSign";
      case "SLACK":
        return "Slack";
      default:
        return c.toLowerCase();
    }
  });
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}
