/**
 * V07 — Trust architecture · CODE-SVG · P0
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §3 V07 (+ V18 compact reuse).
 * Question answered: "How do you protect my data?" (Q6).
 *
 * A layered diagram (boxes, hairline, no lock-icon clichés). Each layer is a
 * control that the code actually backs — verified before committing the labels
 * (feedback_no_guesses_no_estimates):
 *   - read-scope only        → lib/integrations/index.ts (OAuth `scopes`)
 *   - per-workspace isolation → Postgres RLS policies (prisma/migrations/
 *                               20260508000000_phase1_init/migration.sql:193+)
 *   - encrypted at rest       → AES-256-GCM (lib/security/payload-crypto.ts,
 *                               lib/security/encryption.ts)
 *   - our API keys, not yours → ANTHROPIC_API_KEY in lib/llm/anthropic-provider.ts
 *   - never used to train      → Anthropic API no-train default (vendor policy,
 *                                not a local code seam — framed as the policy
 *                                statement it is)
 *   - every action audit-logged → AuditLog model (prisma/schema.prisma:984)
 *   - you approve every send   → ties to V06 control loop
 *
 * Pure, server-rendered inline <svg>. Accepts `compact` for the V18 connect-time
 * micro-diagram (drops the longest labels, tighter viewBox). Brand palette only.
 */

// `import React` required: tsconfig uses jsx: preserve (classic runtime).
import React from "react";

const PAPER = "#F5F0E6";
const PAPER_DEEP = "#ECE5D6";
const INK = "#1A1612";
const CLAY = "#B85540";
const RULE = "#D8CFBA";
const MOSS = "#3F5C3F";

interface Layer {
  label: string;
  /** Clay = the human-control layer (ties to V06). */
  accent?: boolean;
}

const LAYERS_FULL: Layer[] = [
  { label: "your connected tools — read scope only" },
  { label: "per-workspace isolation (row-level security)" },
  { label: "encrypted at rest (AES-256-GCM)" },
  { label: "our API keys, not yours" },
  { label: "your data is never used to train models" },
  { label: "every action audit-logged" },
  { label: "you approve every send", accent: true },
];

const LAYERS_COMPACT: Layer[] = [
  { label: "read scope only" },
  { label: "encrypted at rest" },
  { label: "you approve every send", accent: true },
];

export interface TrustArchitectureProps {
  /** Compact connect-time variant (V18) — fewer layers, tighter box. */
  compact?: boolean;
}

export function TrustArchitecture({ compact = false }: TrustArchitectureProps) {
  const layers = compact ? LAYERS_COMPACT : LAYERS_FULL;
  const VB_W = compact ? 360 : 520;
  const rowH = compact ? 40 : 48;
  const pad = 16;
  const VB_H = pad * 2 + layers.length * rowH + (layers.length - 1) * 8;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      role="img"
      aria-label={`How your data is protected: ${layers.map((l) => l.label).join("; ")}.`}
      style={{ display: "block", maxWidth: compact ? "360px" : "100%" }}
    >
      <rect x="0" y="0" width={VB_W} height={VB_H} fill={PAPER} />
      {layers.map((layer, i) => {
        const y = pad + i * (rowH + 8);
        const stroke = layer.accent ? CLAY : INK;
        const dotFill = layer.accent ? CLAY : MOSS;
        return (
          <g key={layer.label}>
            <rect
              x={pad}
              y={y}
              width={VB_W - pad * 2}
              height={rowH}
              fill={i % 2 === 0 ? PAPER : PAPER_DEEP}
              stroke={stroke}
              strokeWidth={layer.accent ? 2 : 1.25}
            />
            {/* A small moss square = a verified control (verified-good signal
                only); clay square on the human-control layer. */}
            <rect
              x={pad + 14}
              y={y + rowH / 2 - 5}
              width={10}
              height={10}
              fill={dotFill}
            />
            <text
              x={pad + 36}
              y={y + rowH / 2 + 4}
              fontFamily="'JetBrains Mono', monospace"
              fontSize={compact ? "11" : "12"}
              fill={layer.accent ? CLAY : INK}
            >
              {layer.label}
            </text>
            {/* hairline connector to the layer below (the data passes down). */}
            {i < layers.length - 1 ? (
              <line
                x1={VB_W / 2}
                y1={y + rowH}
                x2={VB_W / 2}
                y2={y + rowH + 8}
                stroke={RULE}
                strokeWidth={1.5}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export default TrustArchitecture;
