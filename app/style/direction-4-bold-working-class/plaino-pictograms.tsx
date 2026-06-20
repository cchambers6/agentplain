/* Direction-4 Plaino pose pictograms.
   Bold, high-contrast, badge-like interpretations of the four work states —
   SIT / FETCH / HERD / SLEEP. Deliberately geometric: this is the bold
   pictogram language for THIS direction, not the canonical brand mark.
   Outline uses currentColor (inverts cleanly on black or white); the orange
   accent is the one punch of alarm color. viewBox 0 0 100 100. */

type PoseProps = { className?: string };

const ORANGE = "#FF6B1F";

const frame = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 6,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

/** SIT — squared up, antenna high, ready for the next job. */
export function PlainoSit({ className }: PoseProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Plaino sitting">
      {/* antenna */}
      <line x1="38" y1="20" x2="38" y2="8" {...frame} />
      <circle cx="38" cy="6" r="3.5" fill={ORANGE} stroke="currentColor" strokeWidth={3} />
      {/* head */}
      <rect x="20" y="20" width="36" height="28" rx="5" {...frame} />
      <rect x="29" y="30" width="8" height="8" fill={ORANGE} />
      {/* front legs */}
      <line x1="26" y1="48" x2="26" y2="84" {...frame} />
      <line x1="48" y1="48" x2="48" y2="84" {...frame} />
      {/* haunch */}
      <path d="M56 40 q26 4 24 30 v14" {...frame} />
      <line x1="80" y1="84" x2="64" y2="84" {...frame} />
      {/* ground */}
      <line x1="14" y1="90" x2="88" y2="90" {...frame} />
    </svg>
  );
}

/** FETCH — leaning in, nose down on the ball. Gets it and brings it back. */
export function PlainoFetch({ className }: PoseProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Plaino fetching">
      <line x1="30" y1="30" x2="26" y2="18" {...frame} />
      <circle cx="25" cy="15" r="3.5" fill={ORANGE} stroke="currentColor" strokeWidth={3} />
      {/* head tipped forward */}
      <rect x="14" y="30" width="34" height="24" rx="5" transform="rotate(8 31 42)" {...frame} />
      <rect x="20" y="38" width="7" height="7" fill={ORANGE} />
      {/* back / body */}
      <path d="M48 40 q26 0 30 26" {...frame} />
      {/* legs */}
      <line x1="40" y1="56" x2="40" y2="82" {...frame} />
      <line x1="74" y1="62" x2="78" y2="82" {...frame} />
      {/* tail up */}
      <line x1="78" y1="40" x2="90" y2="28" {...frame} />
      {/* ball */}
      <circle cx="22" cy="78" r="9" fill={ORANGE} stroke="currentColor" strokeWidth={5} />
      <line x1="14" y1="90" x2="88" y2="90" {...frame} />
    </svg>
  );
}

/** HERD — low, locked on, driving the work forward. Motion behind. */
export function PlainoHerd({ className }: PoseProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Plaino herding">
      {/* motion lines */}
      <line x1="6" y1="40" x2="20" y2="40" {...frame} strokeWidth={5} />
      <line x1="4" y1="54" x2="18" y2="54" {...frame} strokeWidth={5} />
      {/* head low and forward */}
      <rect x="60" y="44" width="30" height="20" rx="5" {...frame} />
      <rect x="80" y="50" width="7" height="7" fill={ORANGE} />
      <line x1="86" y1="44" x2="90" y2="34" {...frame} />
      <circle cx="91" cy="32" r="3.2" fill={ORANGE} stroke="currentColor" strokeWidth={3} />
      {/* crouched body */}
      <path d="M60 54 q-22 -2 -32 8" {...frame} />
      {/* legs braced */}
      <line x1="30" y1="60" x2="26" y2="84" {...frame} />
      <line x1="58" y1="60" x2="60" y2="84" {...frame} />
      <line x1="14" y1="90" x2="88" y2="90" {...frame} />
    </svg>
  );
}

/** SLEEP — curled, off the clock, work's done. */
export function PlainoSleep({ className }: PoseProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Plaino sleeping">
      {/* curled body */}
      <path d="M18 78 q-4 -34 32 -34 q34 0 30 34 z" {...frame} />
      {/* tucked head */}
      <rect x="20" y="56" width="26" height="20" rx="5" {...frame} />
      <line x1="26" y1="64" x2="40" y2="64" {...frame} strokeWidth={4} />
      {/* z's */}
      <path d="M62 30 h12 l-12 12 h12" {...frame} strokeWidth={5} />
      <path d="M78 16 h8 l-8 8 h8" stroke={ORANGE} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="14" y1="90" x2="88" y2="90" {...frame} />
    </svg>
  );
}

/** Compact stacked head-on mark for the stamp lockup. */
export function PlainoMark({ className }: PoseProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Plaino">
      <line x1="50" y1="22" x2="50" y2="8" {...frame} />
      <circle cx="50" cy="6" r="4" fill={ORANGE} stroke="currentColor" strokeWidth={3} />
      <rect x="26" y="22" width="48" height="36" rx="7" {...frame} />
      <rect x="36" y="34" width="10" height="10" fill={ORANGE} />
      <rect x="54" y="34" width="10" height="10" fill="currentColor" />
      <line x1="40" y1="58" x2="40" y2="80" {...frame} />
      <line x1="60" y1="58" x2="60" y2="80" {...frame} />
      {/* ears */}
      <path d="M26 26 l-10 -8" {...frame} />
      <path d="M74 26 l10 -8" {...frame} />
    </svg>
  );
}
