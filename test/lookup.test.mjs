import test from 'node:test'
import assert from 'node:assert/strict'
import { getEmptyAnalysisMessage } from '../src/lib/analysis-status.ts'
import { getAllRepos, getUser, GitHubApiError } from '../src/lib/github.ts'

test('empty discovery, unavailable stats and legacy cache make different claims', () => {
  assert.match(getEmptyAnalysisMessage(0), /No public repositories were found/)
  assert.match(getEmptyAnalysisMessage(0), /private repositories are not included/)
  for (const count of [1, 10, null]) {
    assert.doesNotMatch(getEmptyAnalysisMessage(count), /No public repositories were found/)
    assert.match(getEmptyAnalysisMessage(count), /does not confirm zero GitHub activity/)
  }
  assert.match(getEmptyAnalysisMessage(null), /Refresh to check/)
})

test('discovery preserves genuine empty vs unavailable responses and recovers', async () => {
  const originalFetch = globalThis.fetch
  let unavailable = ''
  let status = 403
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.headers?.Authorization, undefined)
    assert.ok(String(url).startsWith('/api/gh?path='))
    const endpoint = new URL(String(url), 'http://fixture.local').searchParams.get('path')
    if (endpoint.includes(unavailable) && unavailable) {
      return new Response(status === 200 ? '{}' : '', { status })
    }
    return new Response(JSON.stringify(endpoint.includes('/orgs?') ? [{ login: 'fixture-org' }] : []))
  }
  try {
    assert.deepEqual(await getAllRepos('fixture-user'), { repos: [], orgs: ['fixture-org'] })
    for (const endpoint of ['/users/fixture-user/repos', '/users/fixture-user/orgs', '/orgs/fixture-org/repos']) {
      unavailable = endpoint
      for (const code of [403, 404, 200]) {
        status = code
        await assert.rejects(getAllRepos('fixture-user'), error => error instanceof GitHubApiError && /discovery is unavailable|denied access/.test(error.message))
      }
    }
    unavailable = ''
    assert.deepEqual(await getAllRepos('fixture-user'), { repos: [], orgs: ['fixture-org'] })
    unavailable = '/users/fixture-user'
    status = 403
    await assert.rejects(getUser('fixture-user'), error => error instanceof GitHubApiError && /denied access/.test(error.message))
    status = 404
    assert.equal(await getUser('fixture-user'), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
