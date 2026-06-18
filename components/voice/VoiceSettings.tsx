"use client";

/**
 * components/voice/VoiceSettings.tsx
 *
 * Owner-facing voice settings: pick the playbook + voice/style per vertical,
 * review recording + retention consent, and listen back to recent calls. The
 * whole panel degrades gracefully before Twilio is provisioned — it shows what
 * WILL be configurable and a clear "not available yet" state, driven by the
 * `readiness` prop (computed from env in `lib/voice/config.ts`).
 *
 * This is a presentational client component. Persisting a chosen voice/style
 * and provisioning a number are wired through the parent (`onSaveVoice`,
 * `onProvision`) so this file stays free of server imports; the number route
 * (`/api/voice/numbers`) and the recording-consent approval card (on
 * /approvals) are the live seams.
 *
 * Never names the underlying model vendor — customer surface (per
 * `feedback_customer_vocab_not_engineer.md`).
 */

import { useState } from "react";
import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  ApRootedEmptyState,
} from "@/components/ui/ap";

export interface VoicePlaybookOption {
  id: string;
  label: string;
  scenario: string;
  welcomeGreeting: string;
  defaultVoice: string;
  guardrails: string[];
}

export interface VoiceCallSummary {
  callSid: string;
  from: string;
  at: string;
  durationSec?: number;
  /** Present once a recording exists + retention allows playback. */
  recordingUrl?: string;
  summary?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export interface VoiceReadiness {
  ready: boolean;
  twilioConfigured: boolean;
  synthesisConfigured: boolean;
  missing: string[];
}

export interface VoiceRecordingState {
  /** Whether an approved, unexpired recording-consent grant exists. */
  consented: boolean;
  retentionDays: number;
  twoPartyPromptRequired: boolean;
}

export interface VoiceSettingsProps {
  workspaceId: string;
  verticalLabel: string;
  readiness: VoiceReadiness;
  playbooks: VoicePlaybookOption[];
  /** Currently active playbook id. */
  activePlaybookId: string;
  recording: VoiceRecordingState;
  callHistory: VoiceCallSummary[];
  /** Persist a voice/style/playbook choice. Parent wires the save action. */
  onSaveVoice?: (input: { playbookId: string; voice: string; style: string }) => void;
}

const VOICE_OPTIONS = [
  { id: "en-US-Neural2-F", label: "Ava — warm, clear (default)" },
  { id: "en-US-Neural2-D", label: "Marcus — calm, low" },
  { id: "Polly.Joanna", label: "Joanna — neutral, professional" },
  { id: "elevenlabs:rachel", label: "Rachel — natural (ElevenLabs)" },
];

const STYLE_OPTIONS = [
  { id: "warm-professional", label: "Warm-professional" },
  { id: "plain", label: "Plain — clear and unfussy" },
  { id: "formal", label: "Formal — precise and reserved" },
];

function priorityTone(priority?: string): string {
  if (priority === "urgent") return "text-red-700";
  if (priority === "high") return "text-amber-700";
  return "text-mute";
}

export function VoiceSettings({
  workspaceId,
  verticalLabel,
  readiness,
  playbooks,
  activePlaybookId,
  recording,
  callHistory,
  onSaveVoice,
}: VoiceSettingsProps) {
  const [playbookId, setPlaybookId] = useState(activePlaybookId);
  const selected = playbooks.find((p) => p.id === playbookId) ?? playbooks[0];
  const [voice, setVoice] = useState(selected?.defaultVoice ?? VOICE_OPTIONS[0].id);
  const [style, setStyle] = useState(STYLE_OPTIONS[0].id);

  return (
    <div className="space-y-8">
      {/* Provisioning status */}
      {!readiness.ready ? (
        <ApPaperCard
          eyebrow="voice line"
          title="Your phone line isn't live yet"
          density="default"
        >
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Plaino can answer your phone, take messages, and turn each call into a
            reviewable to-do — once the phone service is connected. These settings
            save now and take effect the moment it goes live.
          </p>
          {readiness.missing.length > 0 ? (
            <ul className="mt-4 space-y-1 font-mono text-[12px] text-mute">
              {readiness.missing.map((m) => (
                <li key={m}>• waiting on: {m}</li>
              ))}
            </ul>
          ) : null}
        </ApPaperCard>
      ) : (
        <ApPaperCard eyebrow="voice line" title="Your phone line is live" density="default">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Calls to your number are answered with the {verticalLabel} playbook below.
          </p>
        </ApPaperCard>
      )}

      {/* Playbook picker */}
      <ApPaperCard eyebrow="how Plaino answers" title="Call playbook">
        <p className="mb-5 text-[15px] leading-relaxed text-ink-soft">
          Pick how Plaino greets and helps callers. Each playbook only takes a
          message and drafts a follow-up — it never quotes prices, gives advice,
          or commits you to anything.
        </p>
        <div className="space-y-3">
          {playbooks.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer gap-3 border p-4 transition ${
                p.id === playbookId ? "border-ink bg-paper" : "border-rule hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name="playbook"
                value={p.id}
                checked={p.id === playbookId}
                onChange={() => {
                  setPlaybookId(p.id);
                  setVoice(p.defaultVoice);
                }}
                className="mt-1"
              />
              <span className="block">
                <span className="block text-[15px] font-medium text-ink">{p.label}</span>
                <span className="mt-0.5 block text-[13px] text-mute">{p.scenario}</span>
                <span className="mt-2 block text-[13px] italic text-ink-soft">
                  “{p.welcomeGreeting}”
                </span>
              </span>
            </label>
          ))}
        </div>
      </ApPaperCard>

      {/* Voice & style */}
      <ApPaperCard eyebrow="sound" title="Voice & style">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <ApEyebrow>voice</ApEyebrow>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="mt-2 w-full border border-rule bg-paper p-2 text-[14px]"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <ApEyebrow>speaking style</ApEyebrow>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="mt-2 w-full border border-rule bg-paper p-2 text-[14px]"
            >
              {STYLE_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6">
          <ApHeritageButton
            variant="primary"
            onClick={() => onSaveVoice?.({ playbookId, voice, style })}
          >
            save voice settings
          </ApHeritageButton>
        </div>
      </ApPaperCard>

      {/* Recording & retention */}
      <ApPaperCard eyebrow="recording" title="Recording & retention">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Recording is <strong>off by default</strong>. Turning it on requires your
          explicit approval on the Approvals page — and in two-party-consent states
          Plaino speaks a recording disclosure to the caller first.
        </p>
        <dl className="mt-4 space-y-2 text-[14px]">
          <div className="flex justify-between border-b border-rule pb-2">
            <dt className="text-mute">Status</dt>
            <dd className="font-medium text-ink">
              {recording.consented ? "On — consented" : "Off — not consented"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-rule pb-2">
            <dt className="text-mute">Retention</dt>
            <dd className="font-medium text-ink">{recording.retentionDays} days</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-mute">Two-party disclosure</dt>
            <dd className="font-medium text-ink">
              {recording.twoPartyPromptRequired ? "Spoken to caller" : "Not required"}
            </dd>
          </div>
        </dl>
        {!recording.consented ? (
          <div className="mt-5">
            <ApHeritageButton
              variant="secondary"
              withArrow
              href={`/app/workspace/${workspaceId}/approvals`}
            >
              review recording consent
            </ApHeritageButton>
          </div>
        ) : null}
      </ApPaperCard>

      {/* Call history */}
      <section>
        <ApEyebrow className="mb-3">recent calls</ApEyebrow>
        {callHistory.length === 0 ? (
          <ApRootedEmptyState
            motif="lone-tree"
            reality="No calls yet."
            change="When your line is live, every call lands here with a summary and a follow-up you can approve."
          />
        ) : (
          <ul className="divide-y divide-rule border border-rule">
            {callHistory.map((c) => (
              <li key={c.callSid} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="text-[14px] font-medium text-ink">{c.from}</p>
                  <p className="text-[12px] text-mute">
                    {c.at}
                    {c.durationSec ? ` · ${Math.round(c.durationSec)}s` : ""}
                  </p>
                  {c.summary ? (
                    <p className={`mt-1 text-[13px] ${priorityTone(c.priority)}`}>{c.summary}</p>
                  ) : null}
                </div>
                {c.recordingUrl ? (
                  <audio controls preload="none" className="h-8 max-w-[200px]">
                    <source src={c.recordingUrl} />
                  </audio>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default VoiceSettings;
