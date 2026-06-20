// (demos) route group — a chromeless shell for self-contained design
// explorations under /style/*. Unlike (marketing), it deliberately does NOT
// mount the real Header / Footer / Plaino widget: each demo ships its own full
// frame (including its own footer) so a direction can be evaluated end-to-end
// without the live paper-themed brand bleeding into the picture. Route groups
// don't affect the URL, so children still resolve at their natural paths
// (e.g. /style/direction-2-minimal-engineering).
export default function DemosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
