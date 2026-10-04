import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'

import { onRequestGet as getAiCatalog } from './api/ai.ts'
import { onRequestGet as getGitHub, onRequestPost as postGitHub } from './api/gh.ts'

const originalFetch = globalThis.fetch

test('shared footer loaders wait for the React-authored host instead of creating a body fallback', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const authoredProject = app.match(/'data-fleet-footer-project': '([^']+)'/)?.[1]
  assert.equal(authoredProject, 'gitstat')
  const loaders = [...html.matchAll(/<script\b[^>]*src="https:\/\/sassmaker\.com\/(?:project-strip|ai-chat-footer)\.js[^>]*>/g)]
  assert.equal(loaders.length, 2)
  for (const [loader] of loaders) {
    // data-host-only maps to the published loaders' script.dataset.hostOnly guard.
    assert.match(loader, /\bdata-host-only="true"/)
    assert.doesNotMatch(loader, /data-fleet-footer-host-only/)
    // Both footer-connect listeners require dataset.project to match the late React host.
    assert.equal(loader.match(/\bdata-project="([^"]+)"/)?.[1], authoredProject)
  }
  // React mounts after deferred loaders; it must remain the sole authored owner.
  assert.doesNotMatch(html, /<fleet-footer-extension\b/)
  assert.equal([...app.matchAll(/createElement\('fleet-footer-extension'/g)].length, 1)
  assert.match(app, /<footer slot="navigation" data-fleet-footer-navigation/)
  assert.match(app, /<saas-maker-newsletter-capture slot="capture"/)
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function context(url: string, method: string, env: Record<string, string | undefined> = {}) {
  const pending: Promise<unknown>[] = []
  return {
    pending,
    value: {
      request: new Request(url, { method }),
      env,
      params: {},
      data: {},
      next: async () => new Response(null),
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    },
  }
}

test('GitHub GET emits only a static endpoint summary when configured', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response('{"ok":true}', { status: 200 })
  }

  const marker = 'private-marker-user-repo'
  const ctx = context(
    `https://git.significanthobbies.com/api/gh?path=/repos/${marker}/contents`,
    'GET',
    { APP_HEALTH_INGEST_KEY: 'test-only-key' },
  )
  const response = await getGitHub(ctx.value as never)
  await Promise.all(ctx.pending)

  assert.equal(response.status, 200)
  assert.equal(calls.length, 2)
  assert.equal(calls[0]?.url, `https://api.github.com/repos/${marker}/contents`)
  const eventBatch = JSON.parse(String(calls[1]?.init?.body)) as { events: Array<Record<string, unknown>> }
  assert.deepEqual(eventBatch.events.map(({ method, route, status_code }) => ({ method, route, status_code })), [
    { method: 'GET', route: '/api/gh', status_code: 200 },
  ])
  assert.equal(JSON.stringify(eventBatch).includes(marker), false)
  assert.deepEqual(Object.keys(eventBatch.events[0] ?? {}).sort(), [
    'duration_ms',
    'event_id',
    'method',
    'route',
    'status_code',
    'timestamp',
  ])
})

test('GitHub GraphQL POST does not include request values in telemetry', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response('{"data":{}}', { status: 200 })
  }

  const marker = 'secret-query-value-marker'
  const ctx = context('https://git.significanthobbies.com/api/gh', 'POST', {
    APP_HEALTH_INGEST_KEY: 'test-only-key',
  })
  Object.defineProperty(ctx.value, 'request', {
    value: new Request('https://git.significanthobbies.com/api/gh', {
      method: 'POST',
      body: JSON.stringify({ query: marker, variables: { username: marker } }),
    }),
  })
  const response = await postGitHub(ctx.value as never)
  await Promise.all(ctx.pending)

  assert.equal(response.status, 200)
  assert.equal(String(calls[0]?.init?.body).includes(marker), true)
  const eventBatch = JSON.parse(String(calls[1]?.init?.body)) as { events: Array<Record<string, unknown>> }
  assert.deepEqual(eventBatch.events.map(({ method, route, status_code }) => ({ method, route, status_code })), [
    { method: 'POST', route: '/api/gh', status_code: 200 },
  ])
  assert.equal(JSON.stringify(eventBatch).includes(marker), false)
})

test('AI catalog reports a static route and missing key leaves collection disabled', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response(null, { status: 204 })
  }

  const enabled = context('https://git.significanthobbies.com/api/ai?username=input-marker', 'GET', {
    APP_HEALTH_INGEST_KEY: 'test-only-key',
  })
  const response = await getAiCatalog(enabled.value as never)
  await Promise.all(enabled.pending)
  const eventBatch = JSON.parse(String(calls[0]?.init?.body)) as { events: Array<Record<string, unknown>> }
  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.deepEqual(eventBatch.events.map(({ method, route, status_code }) => ({ method, route, status_code })), [
    { method: 'GET', route: '/api/ai', status_code: 200 },
  ])
  assert.equal(JSON.stringify(eventBatch).includes('input-marker'), false)

  calls.length = 0
  const disabled = context('https://git.significanthobbies.com/api/ai', 'GET')
  assert.equal((await getAiCatalog(disabled.value as never)).status, 200)
  await Promise.all(disabled.pending)
  assert.equal(calls.length, 0)

  globalThis.fetch = async () => {
    calls.push({ url: 'https://api.github.com/repos/example/public' })
    return new Response('{"ok":true}', { status: 200 })
  }
  const proxyWithoutKey = context('https://git.significanthobbies.com/api/gh?path=/repos/example/public', 'GET')
  assert.equal((await getGitHub(proxyWithoutKey.value as never)).status, 200)
  await Promise.all(proxyWithoutKey.pending)
  assert.equal(calls.length, 1)
})
