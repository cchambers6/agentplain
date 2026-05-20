// Static SVG lockup library for the agentplain logo comparison page.
// Each builder returns the inner SVG markup (no <svg> wrapper) for a candidate.
// Used by build-html.mjs and build-png.mjs.

const FONT_STACK = "'Source Serif 4','Source Serif Pro',Georgia,serif";

const wordmark = (x, y) =>
  `<text x="${x}" y="${y}" font-family="${FONT_STACK}" font-size="32" font-weight="500" letter-spacing="-0.5" fill="currentColor">agentplain</text>`;

const markWheat = `
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" y1="22" x2="20" y2="22" stroke-width="0.7" opacity="0.55"/>
      <path d="M8 22 C8 18 7.5 14 7 10" stroke-width="1.2"/>
      <path d="M7 10 L5 8" stroke-width="1"/>
      <path d="M7 10 L9 8" stroke-width="1"/>
      <path d="M7.2 12 L5.4 10.4" stroke-width="0.9"/>
      <path d="M7.2 12 L9 10.4" stroke-width="0.9"/>
      <path d="M7.4 14 L5.8 12.6" stroke-width="0.9"/>
      <path d="M7.4 14 L9 12.6" stroke-width="0.9"/>
      <path d="M12 22 L12 6" stroke-width="1.3"/>
      <path d="M12 6 L10 4" stroke-width="1"/>
      <path d="M12 6 L14 4" stroke-width="1"/>
      <path d="M12 8 L10 6.4" stroke-width="0.95"/>
      <path d="M12 8 L14 6.4" stroke-width="0.95"/>
      <path d="M12 10 L10 8.4" stroke-width="0.9"/>
      <path d="M12 10 L14 8.4" stroke-width="0.9"/>
      <path d="M12 12 L10.2 10.4" stroke-width="0.9"/>
      <path d="M12 12 L13.8 10.4" stroke-width="0.9"/>
      <path d="M16 22 C16 18 16.5 14 17 10" stroke-width="1.2"/>
      <path d="M17 10 L15 8" stroke-width="1"/>
      <path d="M17 10 L19 8" stroke-width="1"/>
      <path d="M16.8 12 L15 10.4" stroke-width="0.9"/>
      <path d="M16.8 12 L18.6 10.4" stroke-width="0.9"/>
      <path d="M16.6 14 L15 12.6" stroke-width="0.9"/>
      <path d="M16.6 14 L18.2 12.6" stroke-width="0.9"/>
    </g>`;

const markTree = `
    <g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <line x1="2" y1="20" x2="22" y2="20" stroke-width="0.9" fill="none"/>
      <line x1="12" y1="20" x2="12" y2="13" stroke-width="1.4" fill="none"/>
      <path d="M12 13 C8.5 13 6.5 10.5 6.5 7.5 C6.5 4.5 9 3 11 4 C11.5 2 13 2 14 4 C16.5 3.5 17.8 5.5 17.5 7.8 C17.2 11 14.5 13 12 13 Z" fill="currentColor" stroke="none"/>
    </g>`;

const markPlaino = `
    <g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3 V5"/>
      <circle cx="12" cy="2.5" r="0.7"/>
      <rect x="6" y="5.5" width="12" height="9"/>
      <path d="M9 9.5 H10"/>
      <path d="M14 9.5 H15"/>
      <path d="M9.5 12 H14.5"/>
      <path d="M11 14.5 V16"/>
      <path d="M13 14.5 V16"/>
      <rect x="7" y="16" width="10" height="5"/>
      <path d="M11 18.5 H13"/>
    </g>`;

const markFurrows = `
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" stroke-width="0.9"/>
      <line x1="3" y1="21" x2="10.5" y2="6" stroke-width="1.1"/>
      <line x1="7" y1="21" x2="11.3" y2="6" stroke-width="1.1"/>
      <line x1="12" y1="21" x2="12" y2="6" stroke-width="1.1"/>
      <line x1="17" y1="21" x2="12.7" y2="6" stroke-width="1.1"/>
      <line x1="21" y1="21" x2="13.5" y2="6" stroke-width="1.1"/>
    </g>`;

// Horizontal lockup: mark in a 24x24 box at top-left, wordmark to the right.
// Translation 0,6 vertically centres the 24-unit mark in the 40-unit row, plus
// the 1.333 scale fits the 24-unit mark into the 32-unit gutter.
const lockupWithMark = (markInnerGroup) => `
  <g transform="translate(0 6)">
    <g transform="scale(1.333)">${markInnerGroup}</g>
  </g>
  ${wordmark(42, 29)}`;

// Per-candidate horizontal lockup body. Keys hold viewBox dims + body markup.
export const CANDIDATES = {
  A: {
    viewBox: '0 0 200 40',
    body: wordmark(0, 29),
  },
  B: {
    viewBox: '0 0 200 50',
    body: `
  <line x1="78" y1="6" x2="122" y2="6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  ${wordmark(0, 39)}`,
  },
  C: { viewBox: '0 0 240 40', body: lockupWithMark(markWheat) },
  D: { viewBox: '0 0 240 40', body: lockupWithMark(markTree) },
  E: { viewBox: '0 0 240 40', body: lockupWithMark(markPlaino) },
  F: { viewBox: '0 0 240 40', body: lockupWithMark(markFurrows) },
};

// Square avatar lockup (used at the 240px social-avatar slot).
// A/B use the monogram "ap"; C-F use the bare mark centred in 48x48.
const monogram = (y, fontSize, letterSpacing) =>
  `<text x="24" y="${y}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="500" letter-spacing="${letterSpacing}" fill="currentColor">ap</text>`;

const avatarWithMark = (markInnerGroup) => `
  <g transform="translate(12 12)">${markInnerGroup}</g>`;

export const AVATARS = {
  A: { viewBox: '0 0 48 48', body: monogram(31, 24, '-0.8') },
  B: {
    viewBox: '0 0 48 48',
    body: `
  <line x1="14" y1="14" x2="34" y2="14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  ${monogram(35, 22, '-0.6')}`,
  },
  C: { viewBox: '0 0 48 48', body: avatarWithMark(markWheat) },
  D: { viewBox: '0 0 48 48', body: avatarWithMark(markTree) },
  E: { viewBox: '0 0 48 48', body: avatarWithMark(markPlaino) },
  F: { viewBox: '0 0 48 48', body: avatarWithMark(markFurrows) },
};

// Build an inline <svg> for a stage at a target lockup height (px).
// Width derives from the aspect ratio; the wordmark + mark scale together.
export function inlineLockup(id, heightPx, extraAttrs = '') {
  const c = CANDIDATES[id];
  // Pull viewBox dims to compute width that preserves aspect ratio.
  const [, , vbW, vbH] = c.viewBox.split(' ').map(Number);
  const width = Math.round((vbW / vbH) * heightPx);
  return `<svg class="lockup" viewBox="${c.viewBox}" width="${width}" height="${heightPx}" role="img" aria-label="agentplain — candidate ${id}"${extraAttrs ? ' ' + extraAttrs : ''}>${c.body}
</svg>`;
}

export function inlineAvatar(id, sizePx, extraAttrs = '') {
  const a = AVATARS[id];
  return `<svg class="lockup" viewBox="${a.viewBox}" width="${sizePx}" height="${sizePx}" role="img" aria-label="agentplain — candidate ${id} avatar"${extraAttrs ? ' ' + extraAttrs : ''}>${a.body}
</svg>`;
}

// Build a free-standing SVG document (with xmlns + an explicit color) for PNG rasterization.
// `theme` is 'light' (paper bg, ink mark) or 'dark' (ink bg, paper mark).
export function freeStandingLockup(id, theme) {
  const c = CANDIDATES[id];
  const color = theme === 'dark' ? '#F7F4ED' : '#1A1A1F';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.viewBox}" role="img" aria-label="agentplain — candidate ${id}" style="color:${color}">${c.body}
</svg>`;
}
