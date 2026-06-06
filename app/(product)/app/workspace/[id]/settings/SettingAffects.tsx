// Settings-local helper (NOT an Ap* primitive — no design-language barrel
// entry required). Renders the consistent "changing this affects" note
// every settings surface carries so the customer can see, in plain words,
// which agent behaviors a knob actually moves. Per the settings-behavior
// audit (feat/settings-behavior-audit-fix): every customer setting must
// state its downstream effect, not just persist a value.

import type { ReactNode } from "react";

export function SettingAffects({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 max-w-2xl border-l-2 border-clay/50 bg-paper px-4 py-3">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        changing this affects
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
        {children}
      </p>
    </div>
  );
}
