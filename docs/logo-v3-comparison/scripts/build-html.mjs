// Regenerates docs/logo-v3-comparison/index.html with every candidate lockup
// inlined into its .size-stage div. The 6 × 4 × 2 candidate grid becomes 100%
// static — no <use> references, no script-populated DOM. The header / card /
// social context-swapper at the top keeps its small JS; it's a nice-to-have.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANDIDATES, inlineLockup, inlineAvatar } from './lockups.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'index.html');

// Per-size lockup heights — same as the old script-built values so the visual
// rhythm matches what Conner already reviewed.
const SIZE_LOCKUP_HEIGHT = { 16: 16, 32: 24, 96: 60, 240: 100 };

const CANDIDATE_META = [
  {
    id: 'A',
    title: 'Pure heritage wordmark — no mark',
    caption: `McKinsey-class restraint. The wordmark carries the whole brand; the Plaino character carries the warmth.
          <span class="strength">Strength:</span> survives any size, never competes with Plaino's avatar, ages well.
          <span class="weakness">Weakness:</span> no glanceable mark for favicons or social avatars — would need a separate monogram for square containers.`,
  },
  {
    id: 'B',
    title: 'Wordmark + horizon line',
    caption: `A short hairline rule above the wordmark — the prairie reduced to its purest gesture. Geometric, calm, abstract.
          <span class="strength">Strength:</span> reads as "the plains" without being literal; sits quietly next to Plaino without arguing for attention.
          <span class="weakness">Weakness:</span> the rule vanishes below 24px — at favicon size the wordmark stands alone, so essentially collapses into Candidate A.`,
  },
  {
    id: 'C',
    title: 'Wordmark + wheat sheaf accent',
    caption: `Three hand-drawn stalks of grain to the left of the wordmark — literal heartland iconography in the same hairline language as the rest of the surface.
          <span class="strength">Strength:</span> the most recognizable "rooted" mark; works as a standalone favicon; signals heritage at first glance.
          <span class="weakness">Weakness:</span> at 16px the kernels turn to mush; risks reading as "farm-tech" rather than "service partner for brokerages."`,
  },
  {
    id: 'D',
    title: 'Wordmark + lone-tree accent',
    caption: `A single tree on a hairline horizon — the lone landmark on the prairie. Conner's earlier top three included this direction.
          <span class="strength">Strength:</span> distinctive silhouette that holds up at favicon size; reads as "rooted" without being agricultural.
          <span class="weakness">Weakness:</span> the canopy can read as a balloon or pin at very small sizes; needs the horizon line to anchor it.`,
  },
  {
    id: 'E',
    title: 'Plaino-as-mark + wordmark',
    caption: `The named character IS the logo — same line-art figure from <code>PlainoAvatar.tsx</code>, anchored to the left of the wordmark.
          <span class="strength">Strength:</span> the most personable; ties the brand to the character; the Plaino avatar already exists across onboarding and email signatures.
          <span class="weakness">Weakness:</span> this is the direction Conner rejected as "too cartoonish for a professional AI consulting logo." The Geico-gecko model argues Plaino should stay <em>warmth on top of</em> a serious wordmark, not be the wordmark itself. Shown here so the rejection is documented next to the alternatives.`,
  },
  {
    id: 'F',
    title: 'Wordmark + plowed-rows accent',
    caption: `Furrows converging to a vanishing point — the prairie in single-point perspective. Geometric, structural, suggests order without an animal or plant in sight.
          <span class="strength">Strength:</span> abstract enough to feel professional, literal enough to feel rooted; the geometry holds up at small sizes better than wheat heads.
          <span class="weakness">Weakness:</span> low immediate recognition — reads as a graphic device before it reads as "plowed fields"; benefits from the wordmark next to it to disambiguate.`,
  },
];

const SIZES = [
  { px: 16, label: '16 · shell' },
  { px: 32, label: '32 · nav' },
  { px: 96, label: '96 · hero' },
  { px: 240, label: '240 · social' },
];

function stageFor(id, sizePx) {
  if (sizePx === 240) {
    return inlineAvatar(id, 120);
  }
  return inlineLockup(id, SIZE_LOCKUP_HEIGHT[sizePx]);
}

function renderCandidate(meta) {
  const lightBlocks = SIZES.map(
    (s) =>
      `            <div class="size-block"><span class="size-label">${s.label}</span><div class="size-stage">${stageFor(meta.id, s.px)}</div></div>`
  ).join('\n');
  const darkBlocks = SIZES.map(
    (s) =>
      `            <div class="size-block"><span class="size-label">${s.label}</span><div class="size-stage">${stageFor(meta.id, s.px)}</div></div>`
  ).join('\n');
  return `      <article class="candidate" data-id="${meta.id}">
        <div class="candidate-head">
          <span class="candidate-letter">${meta.id}</span>
          <h3 class="candidate-title">${meta.title}</h3>
        </div>
        <p class="candidate-caption">
          ${meta.caption}
        </p>
        <div class="size-row">
          <div class="size-col size-col-light">
            <div class="size-col-label">On paper</div>
${lightBlocks}
          </div>
          <div class="size-col size-col-dark">
            <div class="size-col-label">On ink</div>
${darkBlocks}
          </div>
        </div>
      </article>`;
}

const HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>agentplain — logo v3 comparison (2026-05-19)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  /* ============================================================
     Canonical brand tokens — pulled from lib/brand/tokens.ts.
     Locked palette: paper #F7F4ED, ink #1A1A1F, clay #B65D3A,
     moss #3F5C3F. Matches every live customer surface.
     ============================================================ */
  :root {
    --paper: #F7F4ED;
    --paper-deep: #EDE9DE;
    --ink: #1A1A1F;
    --ink-soft: #2E2E33;
    --clay: #B65D3A;
    --clay-deep: #9A4D2F;
    --moss: #3F5C3F;
    --moss-deep: #2A3F2A;
    --mute: #8C8478;
    --rule: #E0DAC9;
    --rule-dark: rgba(247, 244, 237, 0.18);

    --display: 'Source Serif 4', 'Source Serif Pro', Georgia, serif;
    --mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--display);
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }

  /* ---------- layout ---------- */
  .shell { max-width: 1180px; margin: 0 auto; padding: 56px 32px 96px; }
  .header { border-bottom: 1px solid var(--rule); padding-bottom: 28px; margin-bottom: 40px; }
  .eyebrow {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--mute);
    margin: 0 0 12px;
  }
  h1 {
    font-family: var(--display);
    font-weight: 500;
    font-size: 44px;
    letter-spacing: -0.8px;
    line-height: 1.1;
    margin: 0 0 16px;
  }
  .lede {
    font-family: var(--display);
    font-size: 18px;
    line-height: 1.55;
    color: var(--ink-soft);
    max-width: 65ch;
    margin: 0;
  }
  .meta {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--mute);
    margin-top: 20px;
  }
  .meta code { color: var(--clay); }

  /* ---------- section heading ---------- */
  .section { margin-top: 64px; }
  .section-head {
    border-bottom: 1px solid var(--rule);
    padding-bottom: 12px;
    margin-bottom: 28px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }
  .section-head h2 {
    font-family: var(--display);
    font-weight: 500;
    font-size: 22px;
    letter-spacing: -0.3px;
    margin: 0;
  }
  .section-head .note {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--mute);
  }

  /* ---------- mock-context preview ---------- */
  .preview-tabs {
    display: flex;
    gap: 0;
    border: 1px solid var(--rule);
    background: var(--paper);
    margin-bottom: 16px;
    width: fit-content;
  }
  .preview-tab {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 10px 18px;
    cursor: pointer;
    background: transparent;
    border: none;
    border-right: 1px solid var(--rule);
    color: var(--mute);
    transition: color 0.15s, background 0.15s;
  }
  .preview-tab:last-child { border-right: none; }
  .preview-tab:hover { color: var(--ink); }
  .preview-tab.is-active { color: var(--ink); background: var(--paper-deep); }

  .candidate-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    border: 1px solid var(--rule);
    background: var(--paper);
    margin-bottom: 24px;
    width: fit-content;
  }
  .candidate-tab {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 8px 14px;
    cursor: pointer;
    background: transparent;
    border: none;
    border-right: 1px solid var(--rule);
    color: var(--mute);
  }
  .candidate-tab:last-child { border-right: none; }
  .candidate-tab:hover { color: var(--ink); }
  .candidate-tab.is-active { color: var(--ink); background: var(--paper-deep); }

  /* ---------- mock contexts ---------- */
  .mock { display: none; }
  .mock.is-active { display: block; }

  /* header strip mock */
  .mock-header { border: 1px solid var(--rule); background: var(--paper); }
  .mock-header-bar {
    height: 64px;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--rule);
  }
  .mock-header-nav {
    display: flex;
    gap: 24px;
    font-family: var(--display);
    font-size: 14px;
    color: var(--ink-soft);
  }
  .mock-header-cta {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 8px 14px;
    background: var(--ink);
    color: var(--paper);
  }
  .mock-header-body { padding: 36px 24px 48px; background: var(--paper); }
  .mock-header-body .lede { font-size: 22px; max-width: 60ch; }

  /* business card mock */
  .mock-card {
    width: 360px;
    height: 220px;
    background: var(--paper);
    border: 1px solid var(--rule);
    padding: 28px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .mock-card-name { font-family: var(--display); font-size: 18px; margin: 0; }
  .mock-card-role {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--mute);
    margin: 4px 0 0;
  }
  .mock-card-contact { font-family: var(--mono); font-size: 11px; color: var(--ink-soft); line-height: 1.7; }

  /* social avatar mock */
  .mock-social { width: 320px; background: var(--paper); border: 1px solid var(--rule); padding: 20px; }
  .mock-social-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .mock-social-avatar {
    width: 48px;
    height: 48px;
    background: var(--ink);
    color: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .mock-social-meta { flex: 1; }
  .mock-social-name { font-family: var(--display); font-size: 15px; font-weight: 500; margin: 0; }
  .mock-social-handle { font-family: var(--mono); font-size: 11px; color: var(--mute); margin: 2px 0 0; }
  .mock-social-body { font-family: var(--display); font-size: 14px; line-height: 1.5; color: var(--ink); }

  /* ---------- candidate grid ---------- */
  .candidates { display: grid; grid-template-columns: 1fr; gap: 48px; }
  .candidate { border-top: 1px solid var(--rule); padding-top: 24px; }
  .candidate:first-child { border-top: none; padding-top: 0; }
  .candidate-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
  .candidate-letter {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    color: var(--clay);
  }
  .candidate-title { font-family: var(--display); font-weight: 500; font-size: 19px; margin: 0; }
  .candidate-caption {
    font-family: var(--display);
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-soft);
    max-width: 72ch;
    margin: 0 0 20px;
  }
  .candidate-caption .strength { color: var(--moss); font-style: italic; }
  .candidate-caption .weakness { color: var(--clay-deep); font-style: italic; }

  .size-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border: 1px solid var(--rule);
    background: var(--paper);
  }
  .size-col { padding: 0; }
  .size-col-light { background: var(--paper); }
  .size-col-dark { background: var(--ink); }
  .size-col-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 8px 16px;
    border-bottom: 1px solid var(--rule);
  }
  .size-col-light .size-col-label { color: var(--mute); }
  .size-col-dark .size-col-label { color: rgba(247, 244, 237, 0.55); border-bottom-color: var(--rule-dark); }

  .size-block {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border-bottom: 1px dashed var(--rule);
    min-height: 56px;
  }
  .size-col-dark .size-block { border-bottom-color: var(--rule-dark); }
  .size-block:last-child { border-bottom: none; }

  .size-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--mute);
    width: 80px;
    flex-shrink: 0;
  }
  .size-col-dark .size-label { color: rgba(247, 244, 237, 0.45); }

  .size-stage { flex: 1; display: flex; align-items: center; overflow: hidden; }

  /* dark variant color flip — invert ink/paper inside the SVG */
  .size-col-dark .lockup { color: var(--paper); }
  .size-col-light .lockup { color: var(--ink); }

  /* In the social slot the avatar lives inside the social square. */
  .mock-social-avatar .lockup { color: var(--paper); }

  /* ---------- pick row ---------- */
  .pick { margin-top: 80px; border-top: 1px solid var(--rule); padding-top: 32px; }
  .pick-head {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--mute);
    margin-bottom: 16px;
  }
  .pick-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    border: 1px solid var(--rule);
    background: var(--paper);
  }
  .pick-option {
    flex: 1 1 0;
    min-width: 140px;
    padding: 18px 20px;
    border-right: 1px solid var(--rule);
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .pick-option:last-child { border-right: none; }
  .pick-option:hover { background: var(--paper-deep); }
  .pick-option input { margin: 0; accent-color: var(--clay); }
  .pick-option label { font-family: var(--display); font-size: 14px; cursor: pointer; }
  .pick-option .pick-letter {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    color: var(--clay);
  }
  .pick-option .pick-row-inner { display: flex; align-items: center; gap: 8px; }
  .pick-option:has(input:checked) { background: var(--paper-deep); }

  /* ---------- PNG link row ---------- */
  .png-row {
    margin-top: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.06em;
  }
  .png-row a {
    color: var(--clay);
    text-decoration: none;
    padding: 4px 10px;
    border: 1px solid var(--rule);
  }
  .png-row a:hover { background: var(--paper-deep); }

  /* ---------- footer ---------- */
  footer {
    margin-top: 80px;
    padding-top: 24px;
    border-top: 1px solid var(--rule);
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--mute);
    line-height: 1.7;
  }
  footer a { color: var(--clay); text-decoration: none; }
  footer a:hover { text-decoration: underline; }

  /* ---------- responsive ---------- */
  @media (max-width: 720px) {
    .shell { padding: 32px 20px 64px; }
    h1 { font-size: 32px; }
    .size-row { grid-template-columns: 1fr; }
    .size-col-dark { border-top: 1px solid var(--rule); }
  }
</style>
</head>
<body>
<div class="shell">

  <header class="header">
    <p class="eyebrow">brand · logo v3 · comparison set</p>
    <h1>Pick the agentplain mark.</h1>
    <p class="lede">Six directions, every one hand-coded against the locked brand: lowercase wordmark in Source Serif 4, the heritage palette, no sleek-tech accents. Each candidate appears at four working sizes on light and dark, and slots into three real-life contexts at the top so you can feel how it lives in the product.</p>
    <p class="meta">tokens: <code>ink #1A1A1F</code> · <code>paper #F7F4ED</code> · <code>clay #B65D3A</code> · <code>moss #3F5C3F</code> · <code>rule #E0DAC9</code> &nbsp; · &nbsp; type: Source Serif 4 / JetBrains Mono &nbsp; · &nbsp; date: 2026-05-19</p>
    <div class="png-row">
      <strong style="color: var(--mute); font-weight: 400; align-self: center;">PNG exports →</strong>
      <a href="png/contact-sheet.png">contact-sheet</a>
      <a href="png/A-light.png">A · paper</a><a href="png/A-dark.png">A · ink</a>
      <a href="png/B-light.png">B · paper</a><a href="png/B-dark.png">B · ink</a>
      <a href="png/C-light.png">C · paper</a><a href="png/C-dark.png">C · ink</a>
      <a href="png/D-light.png">D · paper</a><a href="png/D-dark.png">D · ink</a>
      <a href="png/E-light.png">E · paper</a><a href="png/E-dark.png">E · ink</a>
      <a href="png/F-light.png">F · paper</a><a href="png/F-dark.png">F · ink</a>
    </div>
  </header>

  <!-- ===== CONTEXT PREVIEW (interactive — JS-driven) ===== -->
  <section class="section" id="contexts">
    <div class="section-head">
      <h2>Try it in context</h2>
      <span class="note">swap a candidate into a real surface</span>
    </div>

    <div class="preview-tabs" role="tablist" aria-label="Preview context">
      <button class="preview-tab is-active" data-context="header" role="tab" aria-selected="true">Header strip</button>
      <button class="preview-tab" data-context="card" role="tab" aria-selected="false">Business card</button>
      <button class="preview-tab" data-context="social" role="tab" aria-selected="false">Social avatar</button>
    </div>

    <div class="candidate-tabs" role="tablist" aria-label="Candidate">
${CANDIDATE_META.map(
  (m, i) =>
    `      <button class="candidate-tab${i === 0 ? ' is-active' : ''}" data-candidate="${m.id}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}">${m.id} · ${m.title.replace(/^(Pure heritage wordmark — no mark|Wordmark \+ |Plaino-as-mark \+ wordmark)/, (full) => {
      if (full === 'Pure heritage wordmark — no mark') return 'pure wordmark';
      if (full === 'Plaino-as-mark + wordmark') return 'Plaino mark';
      return full.replace('Wordmark + ', '').replace(' accent', '');
    })}</button>`
).join('\n')}
    </div>

    <div class="mock mock-header-wrap is-active" data-mock="header">
      <div class="mock-header">
        <div class="mock-header-bar">
          <div class="mock-stage" data-slot="header" style="height: 32px; display: flex; align-items: center;">${inlineLockup('A', 24)}</div>
          <nav class="mock-header-nav">
            <span>Product</span><span>Verticals</span><span>Pricing</span><span>Sign in</span>
            <span class="mock-header-cta">Book a call</span>
          </nav>
        </div>
        <div class="mock-header-body">
          <p class="eyebrow" style="margin-bottom: 8px;">For independent brokerages</p>
          <p class="lede">Hand the inbox, the calendar, and the showing chase to a service partner you can supervise from one page.</p>
        </div>
      </div>
    </div>

    <div class="mock" data-mock="card">
      <div class="mock-card">
        <div class="mock-stage" data-slot="card" style="height: 28px; display: flex; align-items: center;">${inlineLockup('A', 24)}</div>
        <div>
          <p class="mock-card-name">Conner Chambers</p>
          <p class="mock-card-role">Founder</p>
        </div>
        <div class="mock-card-contact">
          conner@agentplain.com<br>
          agentplain.com
        </div>
      </div>
    </div>

    <div class="mock" data-mock="social">
      <div class="mock-social">
        <div class="mock-social-row">
          <div class="mock-social-avatar mock-stage" data-slot="social-avatar">${inlineAvatar('A', 48)}</div>
          <div class="mock-social-meta">
            <p class="mock-social-name">agentplain</p>
            <p class="mock-social-handle">@agentplain · sponsored</p>
          </div>
        </div>
        <p class="mock-social-body">A service partnership for independent brokerages — your AMS, your inbox, your calendar, supervised from a single page.</p>
      </div>
    </div>
  </section>

  <!-- ===== CANDIDATES (static — every lockup inlined) ===== -->
  <section class="section" id="candidates">
    <div class="section-head">
      <h2>Six candidates at four sizes</h2>
      <span class="note">each on paper · ink</span>
    </div>

    <div class="candidates">

${CANDIDATE_META.map(renderCandidate).join('\n\n')}

    </div>
  </section>

  <section class="pick">
    <p class="pick-head">Conner's pick</p>
    <form class="pick-row" onsubmit="return false;">
${CANDIDATE_META.map((m) => {
  const label = (() => {
    if (m.id === 'A') return 'pure wordmark';
    if (m.id === 'B') return 'horizon line';
    if (m.id === 'C') return 'wheat sheaf';
    if (m.id === 'D') return 'lone tree';
    if (m.id === 'E') return 'Plaino mark';
    return 'furrows';
  })();
  return `      <label class="pick-option"><div class="pick-row-inner"><input type="radio" name="pick" value="${m.id}"><span class="pick-letter">${m.id}</span><span>${label}</span></div></label>`;
}).join('\n')}
    </form>
  </section>

  <footer>
    <p>Static comparison artifact. Every lockup in the candidate grid is fully expanded inline SVG — no JavaScript required to view the six directions on light and dark. The interactive context-swapper above does use a small script; if JS is off, it just shows candidate A in each context.</p>
    <p>Brand tokens canonical to <code>lib/brand/tokens.ts</code>. Wordmark locked: <code>agentplain</code> lowercase, no space. Per <code>project_brand_locked.md</code>.</p>
  </footer>

</div>

<script>
  // Context-swapper only. The 6×4×2 candidate grid is static — this script is
  // optional and just toggles header/card/social previews and swaps which
  // candidate fills them. If JS is disabled, candidate A renders by default.
  (function () {
    var LOCKUPS = ${JSON.stringify(
      Object.fromEntries(
        Object.keys(CANDIDATES).map((id) => [
          id,
          { h: inlineLockup(id, 24), a: inlineAvatar(id, 48) },
        ])
      )
    )};

    var activeContext = 'header';
    var activeCandidate = 'A';

    document.querySelectorAll('.preview-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeContext = btn.dataset.context;
        document.querySelectorAll('.preview-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === btn);
          t.setAttribute('aria-selected', t === btn ? 'true' : 'false');
        });
        document.querySelectorAll('.mock').forEach(function (m) {
          m.classList.toggle('is-active', m.dataset.mock === activeContext);
        });
        renderMock();
      });
    });

    document.querySelectorAll('.candidate-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCandidate = btn.dataset.candidate;
        document.querySelectorAll('.candidate-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === btn);
          t.setAttribute('aria-selected', t === btn ? 'true' : 'false');
        });
        renderMock();
      });
    });

    function renderMock() {
      var entry = LOCKUPS[activeCandidate];
      var headerSlot = document.querySelector('[data-slot="header"]');
      if (headerSlot) headerSlot.innerHTML = entry.h;
      var cardSlot = document.querySelector('[data-slot="card"]');
      if (cardSlot) cardSlot.innerHTML = entry.h;
      var socialSlot = document.querySelector('[data-slot="social-avatar"]');
      if (socialSlot) socialSlot.innerHTML = entry.a;
    }
  })();
</script>

</body>
</html>
`;

fs.writeFileSync(OUT, HEAD);
console.log('Wrote', OUT, '—', HEAD.length, 'bytes');
