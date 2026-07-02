/**
 * V13 — Onboarding roadmap (5 steps) · CODE-SVG / REACT stepper · P0
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §3 V13.
 * Question answered: "What happens after I sign up? What's the path?" (Q5).
 *
 * A 5-node horizontal stepper:
 *   pick your vertical → connect your first tool (60s) → see the fleet's first
 *   drafts (minutes) → review & approve → steady rhythm.
 *
 * On the onboarding page it doubles as a PROGRESS indicator — pass `currentStep`
 * (0-based) to light the current/completed steps clay. With no prop it's the
 * static signup-confirmation variant. Pure, server-rendered inline <svg>.
 * Brand palette only.
 */

// `import React` required: tsconfig uses jsx: preserve (classic runtime).
import React from "react";

const PAPER = "#F5F0E6";
const INK = "#1A1612";
const CLAY = "#B85540";
const RULE = "#D8CFBA";
const MUTE = "#726A5E";

interface Step {
  label: string;
  sub?: string;
}

const STEPS: Step[] = [
  { label: "pick your vertical" },
  { label: "connect your first tool", sub: "~60s" },
  { label: "first drafts land", sub: "minutes" },
  { label: "review & approve" },
  { label: "steady rhythm" },
];

export interface OnboardingRoadmapProps {
  /**
   * 0-based index of the current step. Steps before it render as completed
   * (clay fill), the current step is clay-outlined, later steps are ink
   * hairline. Omit for the static (signup-confirmation) variant.
   */
  currentStep?: number;
}

export function OnboardingRoadmap({ currentStep }: OnboardingRoadmapProps) {
  const VB_W = 920;
  const VB_H = 140;
  const cy = 56;
  const r = 13;
  const gap = (VB_W - 80) / (STEPS.length - 1);
  const cx = (i: number) => 40 + i * gap;

  const ariaProgress =
    currentStep === undefined
      ? ""
      : ` Current step: ${STEPS[Math.min(currentStep, STEPS.length - 1)]?.label}.`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      role="img"
      aria-label={`Onboarding roadmap, five steps: ${STEPS.map((s) => s.label).join(", ")}.${ariaProgress}`}
      style={{ display: "block", maxWidth: "100%" }}
    >
      <rect x="0" y="0" width={VB_W} height={VB_H} fill={PAPER} />

      {/* Connecting rail. */}
      {STEPS.slice(0, -1).map((_, i) => {
        const done =
          currentStep !== undefined && i < currentStep ? CLAY : RULE;
        return (
          <line
            key={`rail-${i}`}
            x1={cx(i) + r}
            y1={cy}
            x2={cx(i + 1) - r}
            y2={cy}
            stroke={done}
            strokeWidth={2}
          />
        );
      })}

      {/* Nodes. */}
      {STEPS.map((step, i) => {
        const isCompleted = currentStep !== undefined && i < currentStep;
        const isCurrent = currentStep !== undefined && i === currentStep;
        const stroke = isCompleted || isCurrent ? CLAY : INK;
        const fill = isCompleted ? CLAY : PAPER;
        const numFill = isCompleted ? PAPER : isCurrent ? CLAY : INK;
        return (
          <g key={step.label}>
            <rect
              x={cx(i) - r}
              y={cy - r}
              width={r * 2}
              height={r * 2}
              fill={fill}
              stroke={stroke}
              strokeWidth={isCurrent ? 2.5 : 1.5}
            />
            <text
              x={cx(i)}
              y={cy + 4}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="12"
              fill={numFill}
            >
              {i + 1}
            </text>
            <text
              x={cx(i)}
              y={cy + r + 22}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="11"
              fill={isCurrent ? CLAY : INK}
            >
              {step.label}
            </text>
            {step.sub ? (
              <text
                x={cx(i)}
                y={cy + r + 38}
                textAnchor="middle"
                fontFamily="'JetBrains Mono', monospace"
                fontSize="10"
                fill={MUTE}
              >
                {step.sub}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export default OnboardingRoadmap;
