/**
 * scripts/run-kaizen-retro.ts
 *
 * CLI entry point for the weekly kaizen retro. The scheduled task
 * (agentplain-weekly-kaizen) invokes this to get the deterministic facts +
 * proposals, then layers its own judgment and posts to Conner.
 *
 * It is intentionally OFFLINE and deterministic — it reads the three YAML data
 * files and prints a structured retro. It does NOT call the Anthropic API (the
 * prod key is paused by policy, and the judgment layer is the scheduled
 * session's job, not the script's). This keeps it cheap, testable, and runnable
 * any time without spend.
 *
 * Usage:
 *   tsx scripts/run-kaizen-retro.ts                 # markdown to stdout (last 7d)
 *   tsx scripts/run-kaizen-retro.ts --json          # full retro object as JSON
 *   tsx scripts/run-kaizen-retro.ts --window-days 14
 *   tsx scripts/run-kaizen-retro.ts --as-of 2026-06-15T09:00:00Z
 *
 * Run from the repo root (paths resolve against process.cwd()).
 */

import { loadKaizenInputs, DEFAULT_WINDOW_DAYS } from '../lib/kaizen/data-readers.js';
import { generateRetro, renderRetroMarkdown } from '../lib/kaizen/proposal-generator.js';

interface Args {
  json: boolean;
  windowDays: number;
  asOf?: Date;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { json: false, windowDays: DEFAULT_WINDOW_DAYS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--window-days') {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--window-days needs a positive number, got "${argv[i]}"`);
      }
      args.windowDays = n;
    } else if (a === '--as-of') {
      const d = new Date(argv[++i]);
      if (!Number.isFinite(d.getTime())) {
        throw new Error(`--as-of needs an ISO date, got "${argv[i]}"`);
      }
      args.asOf = d;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function printHelp(): void {
  process.stdout.write(
    [
      'run-kaizen-retro — weekly fleet self-improvement retro',
      '',
      'Options:',
      '  --json              Emit the full retro object as JSON instead of markdown',
      '  --window-days N     Look-back window in days (default 7)',
      '  --as-of <ISO>       Compute the window relative to this instant (default now)',
      '  --help, -h          Show this help',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputs = await loadKaizenInputs({
    windowDays: args.windowDays,
    now: args.asOf,
  });
  const retro = generateRetro(inputs, {
    generatedAt: (args.asOf ?? new Date()).toISOString(),
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(retro, null, 2) + '\n');
  } else {
    process.stdout.write(renderRetroMarkdown(retro) + '\n');
  }
}

main().catch((err) => {
  process.stderr.write(`kaizen retro failed: ${err?.stack ?? err}\n`);
  process.exit(1);
});
