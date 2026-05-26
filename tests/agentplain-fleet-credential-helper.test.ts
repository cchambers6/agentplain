// Smoke test for scripts/git/agentplain-fleet-credential-helper.ts.
// The minter is mocked so the test doesn't need the real PEM or a network.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runCredentialHelper } from '../scripts/git/agentplain-fleet-credential-helper'

const MOCK_TOKEN = 'ghs_fake_for_test_only'
const mockMint = async () => ({ token: MOCK_TOKEN })

function stdinFor(opts: { protocol?: string; host?: string; path?: string }): string {
  const lines: string[] = []
  if (opts.protocol) lines.push(`protocol=${opts.protocol}`)
  if (opts.host) lines.push(`host=${opts.host}`)
  if (opts.path) lines.push(`path=${opts.path}`)
  lines.push('')
  return lines.join('\n')
}

test('emits username + password for github.com under cchambers6', async () => {
  const out = await runCredentialHelper(
    {
      action: 'get',
      stdin: stdinFor({ protocol: 'https', host: 'github.com', path: 'cchambers6/agentplain.git' }),
    },
    { mint: mockMint },
  )
  assert.equal(out, `username=x-access-token\npassword=${MOCK_TOKEN}\n`)
})

test('case-insensitive owner match (Git can lowercase paths)', async () => {
  const out = await runCredentialHelper(
    {
      action: 'get',
      stdin: stdinFor({ protocol: 'https', host: 'github.com', path: 'CChambers6/agentplain.git' }),
    },
    { mint: mockMint },
  )
  assert.equal(out, `username=x-access-token\npassword=${MOCK_TOKEN}\n`)
})

test('emits nothing for a different host (gitlab.com)', async () => {
  const out = await runCredentialHelper(
    {
      action: 'get',
      stdin: stdinFor({ protocol: 'https', host: 'gitlab.com', path: 'cchambers6/agentplain.git' }),
    },
    { mint: mockMint },
  )
  assert.equal(out, '')
})

test('emits nothing for github.com under a different owner', async () => {
  const out = await runCredentialHelper(
    {
      action: 'get',
      stdin: stdinFor({ protocol: 'https', host: 'github.com', path: 'someone-else/repo.git' }),
    },
    { mint: mockMint },
  )
  assert.equal(out, '')
})

test('emits nothing when path is absent (useHttpPath not enabled)', async () => {
  const out = await runCredentialHelper(
    {
      action: 'get',
      stdin: stdinFor({ protocol: 'https', host: 'github.com' }),
    },
    { mint: mockMint },
  )
  assert.equal(out, '')
})

test('emits nothing for non-https protocols', async () => {
  const out = await runCredentialHelper(
    {
      action: 'get',
      stdin: stdinFor({ protocol: 'ssh', host: 'github.com', path: 'cchambers6/agentplain.git' }),
    },
    { mint: mockMint },
  )
  assert.equal(out, '')
})

test('emits nothing for non-get actions (store, erase)', async () => {
  for (const action of ['store', 'erase', '', 'unknown']) {
    const out = await runCredentialHelper(
      {
        action,
        stdin: stdinFor({ protocol: 'https', host: 'github.com', path: 'cchambers6/agentplain.git' }),
      },
      { mint: mockMint },
    )
    assert.equal(out, '', `action=${action} should be a no-op`)
  }
})

test('does not call the minter for off-target requests', async () => {
  let mintCalls = 0
  const trackingMint = async () => {
    mintCalls += 1
    return { token: MOCK_TOKEN }
  }
  await runCredentialHelper(
    {
      action: 'get',
      stdin: stdinFor({ protocol: 'https', host: 'example.com', path: 'cchambers6/agentplain.git' }),
    },
    { mint: trackingMint },
  )
  await runCredentialHelper(
    {
      action: 'erase',
      stdin: stdinFor({ protocol: 'https', host: 'github.com', path: 'cchambers6/agentplain.git' }),
    },
    { mint: trackingMint },
  )
  assert.equal(mintCalls, 0, 'mint must not run for off-target host or non-get action')
})

test('tolerates CRLF line endings in stdin', async () => {
  const stdin = 'protocol=https\r\nhost=github.com\r\npath=cchambers6/agentplain.git\r\n\r\n'
  const out = await runCredentialHelper({ action: 'get', stdin }, { mint: mockMint })
  assert.equal(out, `username=x-access-token\npassword=${MOCK_TOKEN}\n`)
})
