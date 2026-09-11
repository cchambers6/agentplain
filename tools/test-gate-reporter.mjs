#!/usr/bin/env node
/**
 * tools/test-gate-reporter.mjs
 *
 * A machine-readable reporter for tools/test-gate.mjs. Emits one JSON object
 * per line (NDJSON) for every test result the runner produces.
 *
 * WHY A REPORTER AND NOT TAP PARSING: the gate needs the test NAME and the
 * FAILURE MESSAGE as data. TAP gives them as text — names are TAP-escaped
 * (`#` becomes `\#`), messages are a YAML block scalar, and both have to be
 * un-escaped by hand. Every one of those steps is a place to silently get a
 * name wrong and mis-attribute a suppression. The reporter API hands over the
 * same values as structured fields, already unescaped.
 *
 * DELIBERATELY OMITTED: `stack` and `location`. Both embed the ABSOLUTE path
 * of the checkout, which differs between a developer's machine, a worktree and
 * the CI runner. The gate matches quarantine signatures against the message
 * only, so a signature cannot be made brittle by where the repo happens to sit
 * on disk. See the `matches` contract in tests/quarantine.json.
 */

/** Flatten an error to a stable one-line-ish signature, without any path. */
function errorSignature(err) {
  if (!err) return { name: '', code: '', message: '' };
  const name = typeof err.name === 'string' ? err.name : '';
  const code = typeof err.code === 'string' ? err.code : '';
  let message = typeof err.message === 'string' ? err.message : String(err);
  // An AssertionError's `cause` sometimes carries the only human sentence.
  if (err.cause) {
    const c =
      typeof err.cause === 'object' && err.cause !== null
        ? (err.cause.message ?? '')
        : String(err.cause);
    if (c && !message.includes(c)) message += `\n${c}`;
  }
  return { name, code, message };
}

export default async function* testGateReporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data ?? {};
    const sig = errorSignature(d.details?.error);
    yield `${JSON.stringify({
      outcome: event.type === 'test:fail' ? 'fail' : 'pass',
      name: typeof d.name === 'string' ? d.name : '',
      file: typeof d.file === 'string' ? d.file : '',
      nesting: typeof d.nesting === 'number' ? d.nesting : 0,
      skip: Boolean(d.skip),
      todo: Boolean(d.todo),
      failureType: d.details?.type ?? '',
      errName: sig.name,
      errCode: sig.code,
      errMessage: sig.message,
    })}\n`;
  }
}
