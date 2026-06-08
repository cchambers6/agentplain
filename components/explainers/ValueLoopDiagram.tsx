/**
 * V01 — The value loop · CODE-SVG · P0
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §3 V01.
 * Question answered: "What even is this? What does agentplain actually do?" (Q2).
 *
 * A horizontal closed loop of five nodes on warm paper, hairline `rule`-stroked,
 * square nodes, mono labels. The human (your approval queue) is the clay-accented
 * node — nothing leaves until your name is on it. This is the no-outbound
 * architecture (`project_no_outbound_architecture`) made visible.
 *
 * Built as CODE-SVG, not illustration, because the five labels are load-bearing
 * product truth (must match the no-outbound architecture) and must stay editable.
 *
 * Pure, prop-less, server-rendered. Returns inline <svg> — renders in node:test
 * via renderToStaticMarkup exactly like the existing Ap* primitives (NOT
 * next/image). Brand palette only; no gradients, no rounded corners, no shadows.
 */

// `import React` required: tsconfig uses jsx: preserve (classic runtime).
import React from "react";

// Brand hexes (source: lib/brand/tokens.ts). Inlined as literals because SVG
// presentation attributes can't read Tailwind tokens, and the diagram must
// render identically under node:test (no CSS pipeline).
const PAPER = "#F7F4ED";
const INK = "#1A1A1F";
const CLAY = "#B65D3A";
const RULE = "#E0DAC9";
const MUTE = "#726A5E";

interface LoopNode {
  /** Mono label. */
  label: string;
  /** Optional second line (sub-detail). */
  sub?: string;
  /** Clay-accented — the human sits here. */
  accent?: boolean;
}

const NODES: LoopNode[] = [
  { label: "your tools", sub: "email · calendar · crm · docs" },
  { label: "the fleet reads" },
  { label: "categorize · draft", sub: "schedule · coordinate" },
  { label: "your approval queue", sub: "you sit here", accent: true },
  { label: "your tools send" },
];

export function ValueLoopDiagram() {
  // Layout: 5 evenly spaced square nodes across a 960-wide viewBox, arrows
  // between, and a return arc from the last node back to the first.
  const VB_W = 960;
  const VB_H = 280;
  const nodeW = 156;
  const nodeH = 96;
  const top = 64;
  const gap = (VB_W - NODES.length * nodeW) / (NODES.length + 1);

  const x = (i: number) => gap + i * (nodeW + gap);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      role="img"
      aria-label="The value loop: your tools feed the fleet, which reads, categorizes, drafts, schedules and coordinates; everything lands in your approval queue where you approve it; only then do your tools send. The loop returns to your tools."
      style={{ display: "block", maxWidth: "100%" }}
    >
      <rect x="0" y="0" width={VB_W} height={VB_H} fill={PAPER} />

      {/* Connecting arrows between adjacent nodes. */}
      {NODES.slice(0, -1).map((_, i) => {
        const fromX = x(i) + nodeW;
        const toX = x(i + 1);
        const midY = top + nodeH / 2;
        return (
          <g key={`arrow-${i}`}>
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

      {/* Return arc — from the last node's bottom back to the first node's
          bottom, closing the loop. Hairline, ink. */}
      <path
        d={`M ${x(NODES.length - 1) + nodeW / 2} ${top + nodeH + 4}
            C ${x(NODES.length - 1) + nodeW / 2} ${VB_H - 16},
              ${x(0) + nodeW / 2} ${VB_H - 16},
              ${x(0) + nodeW / 2} ${top + nodeH + 12}`}
        fill="none"
        stroke={RULE}
        strokeWidth={1.5}
      />
      <polygon
        points={`${x(0) + nodeW / 2 - 5},${top + nodeH + 14} ${x(0) + nodeW / 2},${top + nodeH + 4} ${x(0) + nodeW / 2 + 5},${top + nodeH + 14}`}
        fill={RULE}
      />

      {/* Nodes. */}
      {NODES.map((node, i) => {
        const nx = x(i);
        const stroke = node.accent ? CLAY : INK;
        const labelFill = node.accent ? CLAY : INK;
        return (
          <g key={node.label}>
            <rect
              x={nx}
              y={top}
              width={nodeW}
              height={nodeH}
              fill={PAPER}
              stroke={stroke}
              strokeWidth={node.accent ? 2 : 1.25}
            />
            <text
              x={nx + nodeW / 2}
              y={node.sub ? top + nodeH / 2 - 6 : top + nodeH / 2 + 4}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="13"
              fill={labelFill}
            >
              {node.label}
            </text>
            {node.sub ? (
              <text
                x={nx + nodeW / 2}
                y={top + nodeH / 2 + 14}
                textAnchor="middle"
                fontFamily="'JetBrains Mono', monospace"
                fontSize="10"
                fill={MUTE}
              >
                {node.sub}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Clay annotation under the approval-queue node. */}
      <text
        x={x(3) + nodeW / 2}
        y={top - 22}
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="11"
        fill={CLAY}
      >
        nothing leaves until your name is on it.
      </text>
    </svg>
  );
}

export default ValueLoopDiagram;
