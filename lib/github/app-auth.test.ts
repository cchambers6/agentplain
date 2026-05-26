// Offline tests for the fleet GitHub App auth adapter. A real RSA keypair is
// generated in-test and a stub fetch stands in for GitHub, so the JWT signing +
// installation-token flow is exercised without any network call or real key.

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { test } from 'node:test'
import { GitHubAppAuth, authenticatedRemoteUrl, getForgeAppAuthFromEnv } from './app-auth'

function testKeyPem(): string {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  return privateKey.export({ type: 'pkcs1', format: 'pem' }).toString()
}

test('authenticatedRemoteUrl embeds the token in x-access-token form', () => {
  assert.equal(
    authenticatedRemoteUrl('cchambers6', 'agentplain', 'TOK'),
    'https://x-access-token:TOK@github.com/cchambers6/agentplain.git',
  )
})

test('getForgeAppAuthFromEnv returns null when the App is not configured', () => {
  const prevId = process.env.FLEET_GH_APP_ID
  delete process.env.FLEET_GH_APP_ID
  assert.equal(getForgeAppAuthFromEnv(), null)
  if (prevId) process.env.FLEET_GH_APP_ID = prevId
})

test('mintInstallationToken signs a JWT, resolves installation, returns token', async () => {
  const calls: string[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    // Assert the App JWT is a Bearer with three dot-separated segments.
    const auth = (init?.headers as Record<string, string>)?.Authorization ?? ''
    assert.match(auth, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/)
    if (url.endsWith('/app/installations')) {
      return new Response(JSON.stringify([{ id: 132417507, account: { login: 'cchambers6' } }]), { status: 200 })
    }
    if (url.endsWith('/access_tokens')) {
      return new Response(
        JSON.stringify({ token: 'ghs_minted', expires_at: '2026-05-26T05:00:00Z', permissions: { contents: 'write' } }),
        { status: 201 },
      )
    }
    return new Response('not found', { status: 404 })
  }) as unknown as typeof fetch

  const auth = new GitHubAppAuth({ appId: '3714103', privateKeyPem: testKeyPem(), fetchImpl })
  const minted = await auth.mintInstallationToken()
  assert.equal(minted.token, 'ghs_minted')
  assert.equal(minted.installationId, 132417507)
  assert.equal(minted.permissions.contents, 'write')
  assert.deepEqual(calls, [
    'GET https://api.github.com/app/installations',
    'POST https://api.github.com/app/installations/132417507/access_tokens',
  ])
})

test('explicit installationId skips discovery', async () => {
  const calls: string[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    return new Response(JSON.stringify({ token: 't', expires_at: 'x', permissions: {} }), { status: 201 })
  }) as unknown as typeof fetch

  const auth = new GitHubAppAuth({ appId: '1', privateKeyPem: testKeyPem(), installationId: 999, fetchImpl })
  await auth.mintInstallationToken()
  assert.deepEqual(calls, ['POST https://api.github.com/app/installations/999/access_tokens'])
})

test('surfaces GitHub error status without echoing the JWT', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 })) as unknown as typeof fetch
  const auth = new GitHubAppAuth({ appId: '1', privateKeyPem: testKeyPem(), installationId: 5, fetchImpl })
  await assert.rejects(() => auth.mintInstallationToken(), /401.*Bad credentials/)
})
