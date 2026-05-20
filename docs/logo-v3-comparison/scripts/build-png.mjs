// Rasterizes every candidate lockup to PNG using @resvg/resvg-js and the
// embedded Source Serif 4 TTF — no headless browser required.
//
// Outputs:
//   docs/logo-v3-comparison/png/{A-F}-{light|dark}.png  (12 files, ~800px wide)
//   docs/logo-v3-comparison/png/contact-sheet.png       (all 6 stacked, ~1000px wide)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { CANDIDATES, freeStandingLockup } from './lockups.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PNG_DIR = path.join(ROOT, 'png');
const FONT_FILE = path.join(PNG_DIR, 'fonts', 'source-serif-4-500.ttf');

if (!fs.existsSync(FONT_FILE)) {
  console.error('Missing Source Serif 4 TTF at', FONT_FILE);
  process.exit(1);
}

fs.mkdirSync(PNG_DIR, { recursive: true });

const fontOpts = {
  fontFiles: [FONT_FILE],
  loadSystemFonts: false,
  defaultFontFamily: 'Source Serif 4',
};

const TARGET_WIDTH = 800;
const PAPER = '#F7F4ED';
const INK = '#1A1A1F';
const CLAY = '#B65D3A';

const outputs = [];

function renderCandidate(id, theme) {
  const svg = freeStandingLockup(id, theme);
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: TARGET_WIDTH },
    background: theme === 'dark' ? INK : PAPER,
    font: fontOpts,
  });
  const png = r.render().asPng();
  const outPath = path.join(PNG_DIR, `${id}-${theme}.png`);
  fs.writeFileSync(outPath, png);
  outputs.push({ path: outPath, bytes: png.length });
  return png;
}

for (const id of Object.keys(CANDIDATES)) {
  renderCandidate(id, 'light');
  renderCandidate(id, 'dark');
}

// ===== Contact sheet =====
// A single PNG showing all 6 candidates stacked vertically with their letter +
// name labels on paper, ~1000px wide. Built as one big SVG with each candidate
// inserted as a nested <svg> at known coordinates, then rasterized in one pass.

const SHEET_W = 1000;
// Each row: 36px label band + 120px logo row + 24px gap = 180px row height
const ROW_LABEL = 36;
const ROW_LOGO = 120;
const ROW_GAP = 28;
const ROW_H = ROW_LABEL + ROW_LOGO + ROW_GAP;
const HEADER_H = 100; // title at top
const PADDING_X = 60;
const SHEET_H = HEADER_H + ROW_H * 6 + 40;

const NAMES = {
  A: 'pure heritage wordmark',
  B: 'wordmark + horizon line',
  C: 'wordmark + wheat sheaf',
  D: 'wordmark + lone tree',
  E: 'Plaino-as-mark + wordmark',
  F: 'wordmark + furrows',
};

const FONT_FAMILY_DISPLAY = "'Source Serif 4','Source Serif Pro',Georgia,serif";

function lockupAtHeight(id, heightPx, x, y) {
  const c = CANDIDATES[id];
  const [, , vbW, vbH] = c.viewBox.split(' ').map(Number);
  const w = Math.round((vbW / vbH) * heightPx);
  // Wrap with currentColor=ink for the contact sheet (paper bg)
  return `<svg x="${x}" y="${y}" width="${w}" height="${heightPx}" viewBox="${c.viewBox}" overflow="visible" style="color:${INK}">${c.body}
</svg>`;
}

const rows = Object.keys(CANDIDATES)
  .map((id, i) => {
    const rowTop = HEADER_H + i * ROW_H;
    const labelY = rowTop + 22;
    const logoTop = rowTop + ROW_LABEL;
    const logoHeight = 80; // visual height of the lockup in the sheet
    // hairline rule above each row except the first
    const rule =
      i === 0
        ? ''
        : `<line x1="${PADDING_X}" y1="${rowTop - ROW_GAP / 2}" x2="${SHEET_W - PADDING_X}" y2="${rowTop - ROW_GAP / 2}" stroke="#E0DAC9" stroke-width="1"/>`;
    return `${rule}
  <text x="${PADDING_X}" y="${labelY}" font-family="'JetBrains Mono',ui-monospace,monospace" font-size="13" letter-spacing="2" fill="${CLAY}">${id}</text>
  <text x="${PADDING_X + 28}" y="${labelY}" font-family="${FONT_FAMILY_DISPLAY}" font-size="17" font-weight="500" fill="${INK}">${NAMES[id]}</text>
  ${lockupAtHeight(id, logoHeight, PADDING_X, logoTop + 6)}`;
  })
  .join('\n');

const sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}" viewBox="0 0 ${SHEET_W} ${SHEET_H}">
  <rect x="0" y="0" width="${SHEET_W}" height="${SHEET_H}" fill="${PAPER}"/>
  <text x="${PADDING_X}" y="50" font-family="${FONT_FAMILY_DISPLAY}" font-size="28" font-weight="500" fill="${INK}" letter-spacing="-0.5">agentplain — logo v3, six candidates</text>
  <text x="${PADDING_X}" y="76" font-family="'JetBrains Mono',ui-monospace,monospace" font-size="11" letter-spacing="2" fill="#8C8478">2026-05-19 · paper #F7F4ED · ink #1A1A1F · Source Serif 4</text>
  ${rows}
</svg>`;

const sheetResvg = new Resvg(sheetSvg, {
  fitTo: { mode: 'width', value: SHEET_W },
  background: PAPER,
  font: fontOpts,
});
const sheetPng = sheetResvg.render().asPng();
const sheetPath = path.join(PNG_DIR, 'contact-sheet.png');
fs.writeFileSync(sheetPath, sheetPng);
outputs.push({ path: sheetPath, bytes: sheetPng.length });

console.log('Rendered', outputs.length, 'PNGs:');
for (const o of outputs) {
  console.log('  ', path.relative(ROOT, o.path).replace(/\\/g, '/'), `(${o.bytes.toLocaleString()} bytes)`);
}
