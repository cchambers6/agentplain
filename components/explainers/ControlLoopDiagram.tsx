/**
 * V06 — Draft-then-approve control loop · CODE-SVG · P0
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §3 V06.
 * Question answered: "Does this thing send emails / move money on its own?"
 * (Q4 control, Q6).
 *
 * A short left-to-right strip: fleet drafts → lands in YOUR queue (clay, with
 * approve/edit/reject glyphs as hairline squares) → only then your system sends.
 * A flag-free, calm composition. Big mono caption:
 * "drafts and proposes — never auto-sends, never moves money, never makes
 * commitments." This is project_no_outbound_architecture made visible.
 *
 * Pure, prop-less, server-rendered inline <svg>. Brand palette only.
 */

// `import React` required: tsconfig uses jsx: preserve (classic runtime).
import React from "react";

const PAPER = "#F5F0E6";
const INK = "#1A1612";
const CLAY = "#B85540";
const RULE = "#D8CFBA";
const MUTE = "#726A5E";

const STEPS = [
  { label: "fleet drafts", accent: false },
  { label: "your queue", accent: true },
  { label: "your system sends", accent: false },
] as const;

export function ControlLoopDiagram() {
  const VB_W = 880;
  const VB_H = 220;
  const nodeW = 200;
  const nodeH = 84;
  const top = 48;
  const gap = (VB_W - STEPS.length * nodeW) / (STEPS.length + 1);
  const x = (i: number) => gap + i * (nodeW + gap);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      role="img"
      aria-label="The control loop: the fleet drafts, every draft lands in your queue where you approve, edit, or reject, and only then does your own system send. The fleet drafts and proposes; it never auto-sends, never moves money, never makes commitments."
      style={{ display: "block", maxWidth: "100%" }}
    >
      <rect x="0" y="0" width={VB_W} height={VB_H} fill={PAPER} />

      {/* Arrows. */}
      {STEPS.slice(0, -1).map((_, i) => {
        const fromX = x(i) + nodeW;
        const toX = x(i + 1);
        const midY = top + nodeH / 2;
        return (
          <g key={`a-${i}`}>
            <line
              x1={fromX + 4}
              y1={midY}
              x2={toX - 10}
              y2={midY}
              stroke={INK}
              strokeWidth={1.5}
            />
            <polygon
              points={`${toX - 10},${midY - 5} ${toX - 2},${midY} ${toX - 10},${midY + 5}`}
              fill={INK}
            />
          </g>
        );
      })}

      {/* Nodes. */}
      {STEPS.map((step, i) => {
        const nx = x(i);
        const stroke = step.accent ? CLAY : INK;
        const fill = step.accent ? CLAY : INK;
        return (
          <g key={step.label}>
            <rect
              x={nx}
              y={top}
              width={nodeW}
              height={nodeH}
              fill={PAPER}
              stroke={stroke}
              strokeWidth={step.accent ? 2 : 1.25}
            />
            <text
              x={nx + nodeW / 2}
              y={step.accent ? top + 30 : top + nodeH / 2 + 4}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="14"
              fill={fill}
            >
              {step.label}
            </text>
            {/* approve / edit / reject glyphs as hairline squares under the
                clay queue node. */}
            {step.accent
              ? ["approve", "edit", "reject"].map((g, gi) => {
                  const sq = 12;
                  const total = 3 * sq + 2 * 10;
                  const startX = nx + nodeW / 2 - total / 2;
                  const gx = startX + gi * (sq + 10);
                  const gy = top + 52;
                  return (
                    <g key={g}>
                      <rect
                        x={gx}
                        y={gy}
                        width={sq}
                        height={sq}
                        fill={PAPER}
                        stroke={CLAY}
                        strokeWidth={1.25}
                      />
                    </g>
                  );
                })
              : null}
          </g>
        );
      })}

      {/* Caption. */}
      <text
        x={VB_W / 2}
        y={VB_H - 28}
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="13"
        fill={MUTE}
      >
        drafts and proposes — never auto-sends, never moves money,
      </text>
      <text
        x={VB_W / 2}
        y={VB_H - 10}
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="13"
        fill={MUTE}
      >
        never makes commitments.
      </text>
    </svg>
  );
}

export default ControlLoopDiagram;
