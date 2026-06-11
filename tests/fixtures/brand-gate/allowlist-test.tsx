// File used to test allowlist behavior.
// Intentionally contains a vendor name that is allowlisted via brand-gate-allow.json
// with path "fixtures/brand-gate/allowlist-test.tsx".
export function SubprocessorDisclosure() {
  return (
    <p>
      We use <strong>Anthropic</strong> for model inference. See our privacy page.
    </p>
  );
}
