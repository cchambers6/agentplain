// Composite-climax capture pipeline (preview-only, reproducible).
//
// Uses the Chromium that Playwright already has on disk (no browser download)
// to render:
//   1. phone-climax-bg.png  — the REAL /approvals route in a 393x852 iPhone
//      viewport at deviceScaleFactor 2 (retina-crisp), scrolled to the focused
//      Maria Garcia counter-offer card.
//   2. CLIMAX_FRAME.png     — the harness (push banner in real brand tokens
//      over that screen) at DSF2 = 786x1704 px. This is the actual ad frame.
//   3. frames/frame_###.png — 72 frames (24fps x 3s) of the banner sliding in.
// Then encodes the sequence to CLIMAX_3SEC.mp4 with Playwright's bundled ffmpeg.
//
// Prereqs (already true in this environment):
//   - `next dev` serving the worktree on PORT (default 3199): the real route
//     /zz-preview-climax and the static harness /zzclimax/harness.html.
//   - playwright-core installed at C:/tmp/pwtools.
//   - Chromium + ffmpeg in the ms-playwright cache.

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";

const require = createRequire("file:///C:/tmp/pwtools/");
const { chromium } = require("playwright-core");

const PORT = process.env.PORT || "3199";
const ROUTE = `http://localhost:${PORT}/zz-preview-climax`;
const HARNESS = `http://localhost:${PORT}/zzclimax/harness.html`;

const OUT = "C:/agentplain-composite-preview/outputs/composite-climax-preview";
const FRAMES = `${OUT}/frames/seq`;
const PUBLIC_BG = "C:/agentplain-composite-preview/public/zzclimax/phone-climax-bg.png";

const MSPW = `${homedir()}/AppData/Local/ms-playwright`;
const CHROME = `${MSPW}/chromium-1217/chrome-win64/chrome.exe`;
const FFMPEG = `${MSPW}/ffmpeg-1011/ffmpeg-win64.exe`;

const FPS = 24;
const DURATION = 3; // seconds
const N = FPS * DURATION; // 72 frames

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // ── 1. Re-capture the real approvals screen at 2x, scrolled to Maria ──────
  await page.goto(ROUTE, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: `::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}html{scrollbar-width:none!important}`,
  });
  // wait for fonts so the serif/mono render in the capture
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const el = document.querySelector("div.ring-clay");
    if (el) {
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + r.top - 124, behavior: "instant" });
    }
  });
  await sleep(250);
  await page.screenshot({ path: `${OUT}/frames/phone-climax-bg@2x.png` });
  // feed the crisp 2x screen into the harness as its background
  copyFileSync(`${OUT}/frames/phone-climax-bg@2x.png`, PUBLIC_BG);

  // a clean top-of-page mobile frame too (deliverable 2, 2x)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(150);
  await page.screenshot({ path: `${OUT}/frames/phone-clean-top@2x.png` });

  // ── 2 + 3. Composite frame + motion sequence from the harness ─────────────
  await page.goto(HARNESS, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const device = page.locator("#device");

  // settled composite = the ad frame
  await page.evaluate(() => window.setBannerProgress(1));
  await sleep(120);
  await device.screenshot({ path: `${OUT}/CLIMAX_FRAME.png` });

  // motion frames
  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 1 : i / (N - 1);
    await page.evaluate((tt) => window.setBannerProgress(tt), t);
    const name = String(i).padStart(3, "0");
    await device.screenshot({ path: `${FRAMES}/frame_${name}.png` });
  }

  await browser.close();

  // ── 4. Encode MP4 (yuv420p, faststart). Even dims (786x1704) already. ─────
  execFileSync(
    FFMPEG,
    [
      "-y",
      "-framerate", String(FPS),
      "-i", `${FRAMES}/frame_%03d.png`,
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
      "-c:v", "libx264",
      "-profile:v", "high",
      "-crf", "18",
      "-movflags", "+faststart",
      `${OUT}/CLIMAX_3SEC.mp4`,
    ],
    { stdio: "inherit" },
  );

  console.log("DONE:", existsSync(`${OUT}/CLIMAX_3SEC.mp4`) ? "mp4 written" : "mp4 MISSING");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
