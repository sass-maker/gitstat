import type {
  RepoStats,
  RateLimitInfo,
  WeekData,
  CommitInfo,
  ContributionDay,
  UserProfile,
  RepoMetadata,
  ContributionTypes,
  PRInfo,
  IssueInfo,
  StarredRepo,
  ActivityEvent,
  PunchCardData,
} from '../types'
import { matchesExclusion } from './filters'

const API_BASE = 'https://api.github.com'
const PROXY_BASE = '/api/gh'

let rateLimitInfo: RateLimitInfo | null = null

export function getRateLimitInfo(): RateLimitInfo | null {
  return rateLimitInfo
}

// ─────────────────── error classification + retry ───────────────────

export type GitHubErrorReason = 'rate_limited' | 'not_found' | 'auth' | 'network' | 'unknown'

export class GitHubApiError extends Error {
  readonly reason: GitHubErrorReason
  constructor(message: string, reason: GitHubErrorReason) {
    super(message)
    this.name = 'GitHubApiError'
    this.reason = reason
  }
}

function classifyError(err: unknown): GitHubErrorReason {
  const status =
    (err as { status?: number })?.status ??
    (err as { response?: { status?: number } })?.response?.status
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()

  if (status === 403) return 'rate_limited'
  if (status === 401) return 'auth'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate_limited'
  if (message.includes('rate limit') || message.includes('secondary rate')) return 'rate_limited'
  if (message.includes('not found')) return 'not_found'
  if (message.includes('bad credentials') || message.includes('unauthorized')) return 'auth'
  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return 'network'
  }
  return 'unknown'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run a GitHub call with exponential backoff. Retries rate-limit and transient
 * network failures; fails fast on auth / not-found errors. Honors GitHub's
 * `retry-after` / `x-ratelimit-reset` headers when present.
 */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4
  const baseDelayMs = opts.baseDelayMs ?? 1000

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const reason = classifyError(err)

      if (reason === 'auth' || reason === 'not_found') {
        throw new GitHubApiError(
          reason === 'auth'
            ? 'GitHub rejected the access token. Reconnect GitHub and try again.'
            : `GitHub returned not-found for ${label}.`,
          reason,
        )
      }

      if (attempt === maxAttempts) break

      const headers =
        (err as { response?: { headers?: Record<string, string> } })?.response?.headers ?? {}
      const retryAfter = Number(headers['retry-after'])
      const reset = Number(headers['x-ratelimit-reset'])
      let delayMs = baseDelayMs * 2 ** (attempt - 1)
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        delayMs = Math.min(retryAfter * 1000, 60_000)
      } else if (Number.isFinite(reset) && reset > 0) {
        delayMs = Math.min(Math.max(reset * 1000 - Date.now(), 0), 60_000)
      }
      delayMs += Math.floor(Math.random() * 500)
      await sleep(delayMs)
    }
  }

  const reason = classifyError(lastErr)
  throw new GitHubApiError(
    reason === 'rate_limited'
      ? "GitHub's rate limit was hit. Try again in a few minutes."
      : `Failed to read GitHub data for ${label} after ${maxAttempts} attempts.`,
    reason,
  )
}

function updateRateLimit(resp: Response) {
  const remaining = parseInt(resp.headers.get('x-ratelimit-remaining') || '0', 10)
  const limit = parseInt(resp.headers.get('x-ratelimit-limit') || '0', 10)
  const reset = parseInt(resp.headers.get('x-ratelimit-reset') || '0', 10)
  if (limit > 0) {
    rateLimitInfo = { remaining, limit, reset }
  }
}

/**
 * Core fetch function.
 * - With user token: calls GitHub API directly (5,000 req/hr, private repos)
 * - Without token: routes through /api/gh proxy (5,000 req/hr shared, public only)
 * Wraps with withRetry for exponential backoff on rate-limit / network errors.
 */
async function ghFetch(path: string, token?: string): Promise<any> {
  return withRetry(path, async () => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    let resp: Response
    if (token) {
      headers.Authorization = `Bearer ${token}`
      resp = await fetch(`${API_BASE}${path}`, { headers })
    } else {
      resp = await fetch(`${PROXY_BASE}?path=${encodeURIComponent(path)}`)
    }

    updateRateLimit(resp)
    if (resp.status === 404) return null
    if (resp.status === 202) return null  // stats computing, empty body
    if (resp.status === 403) {
      const remaining = resp.headers.get('x-ratelimit-remaining')
      if (remaining === '0') {
        const reset = parseInt(resp.headers.get('x-ratelimit-reset') || '0', 10)
        const mins = Math.ceil((reset - Date.now() / 1000) / 60)
        throw new GitHubApiError(`Rate limit exceeded. Resets in ${mins} min.`, 'rate_limited')
      }
      return null
    }
    if (!resp.ok) {
      const err = new Error(`GitHub API ${resp.status}: ${await resp.text()}`) as any
      err.status = resp.status
      err.response = { headers: Object.fromEntries(resp.headers.entries()) }
      throw err
    }
    const text = await resp.text()
    if (!text) return null
    return JSON.parse(text)
  })
}

/**
 * Fetch with 202 retry support for stats endpoints.
 * Used by getContributorStats which returns 202 while computing.
 */
async function ghFetchWithRetry(
  path: string,
  token: string | undefined,
  maxRetries = 5,
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let resp: Response
    if (token) {
      resp = await fetch(`${API_BASE}${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${token}`,
        },
      })
    } else {
      resp = await fetch(`${PROXY_BASE}?path=${encodeURIComponent(path)}`)
    }

    updateRateLimit(resp)

    if (resp.status === 202) {
      await new Promise((r) => setTimeout(r, 3000))
      continue
    }
    return resp
  }
  // Return last response (will be 202)
  return new Response(null, { status: 202 })
}

export async function getUser(username: string, token?: string) {
  return ghFetch(`/users/${username}`, token)
}

/**
 * Get orgs for the authenticated user (requires OAuth).
 */
export async function getUserOrgs(token: string) {
  const orgs: any[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(`/user/orgs?per_page=100&page=${page}`, token)
    if (!batch || batch.length === 0) break
    orgs.push(...batch)
    if (batch.length < 100) break
    page++
  }
  return orgs
}

/**
 * Get public org memberships for a user (no OAuth needed).
 */
export async function getUserPublicOrgs(username: string, token?: string) {
  const orgs: any[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(`/users/${username}/orgs?per_page=100&page=${page}`, token)
    if (!batch || batch.length === 0) break
    orgs.push(...batch)
    if (batch.length < 100) break
    page++
  }
  return orgs
}

export async function getOrgRepos(org: string, token?: string): Promise<string[]> {
  const repos: string[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(`/orgs/${org}/repos?per_page=100&page=${page}&type=public`, token)
    if (!batch || batch.length === 0) break
    for (const r of batch) repos.push(r.full_name)
    if (batch.length < 100) break
    page++
  }
  return repos
}

/**
 * Get repos owned by the authenticated user (requires OAuth).
 */
export async function getUserRepos(token: string): Promise<string[]> {
  const repos: string[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(`/user/repos?per_page=100&page=${page}&affiliation=owner&sort=pushed`, token)
    if (!batch || batch.length === 0) break
    for (const r of batch) repos.push(r.full_name)
    if (batch.length < 100) break
    page++
  }
  return repos
}

/**
 * Get public repos for any user (no OAuth needed).
 */
export async function getPublicUserRepos(username: string, token?: string): Promise<string[]> {
  const repos: string[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(`/users/${username}/repos?per_page=100&page=${page}&sort=pushed&type=public`, token)
    if (!batch || batch.length === 0) break
    for (const r of batch) repos.push(r.full_name)
    if (batch.length < 100) break
    page++
  }
  return repos
}

export async function getContributorStats(
  repo: string,
  targetLogin: string,
  token?: string,
  maxRetries = 5,
): Promise<RepoStats | null> {
  const resp = await ghFetchWithRetry(`/repos/${repo}/stats/contributors`, token, maxRetries)

  if (resp.status === 202 || resp.status === 404 || resp.status === 403) return null
  if (!resp.ok) return null

  const text = await resp.text()
  if (!text) return null
  const data = JSON.parse(text)
  if (!Array.isArray(data) || data.length === 0) return null

  const entry = data.find((c: any) => c.author?.login?.toLowerCase() === targetLogin.toLowerCase())
  if (!entry) return null

  const weeks: WeekData[] = (entry.weeks || []).map((w: any) => ({
    w: w.w,
    a: w.a || 0,
    d: w.d || 0,
    c: w.c || 0,
  }))
  const additions = weeks.reduce((sum, w) => sum + w.a, 0)
  const deletions = weeks.reduce((sum, w) => sum + w.d, 0)

  return {
    repo,
    commits: entry.total || 0,
    additions,
    deletions,
    weeks,
  }
}

export async function getRepoLanguages(repo: string, token?: string): Promise<Record<string, number>> {
  try {
    return await ghFetch(`/repos/${repo}/languages`, token) || {}
  } catch {
    return {}
  }
}

/**
 * Discover all repos for a user.
 * - With OAuth: user's own repos (incl. private) + all org repos
 * - Without OAuth: user's public repos + public org repos
 */
export async function getAllRepos(
  username: string,
  token?: string,
): Promise<{ repos: string[]; orgs: string[] }> {
  if (token) {
    // Authenticated: get own repos + org repos
    const [userRepos, orgs] = await Promise.all([
      getUserRepos(token),
      getUserOrgs(token),
    ])

    const orgLogins = orgs.map((o) => o.login)
    const orgRepoLists = await Promise.all(
      orgLogins.map((org) => getOrgRepos(org, token)),
    )

    const allRepos = [...new Set([...userRepos, ...orgRepoLists.flat()])]
    return { repos: allRepos, orgs: orgLogins }
  } else {
    // Public: get user's public repos + public org memberships
    const [userRepos, orgs] = await Promise.all([
      getPublicUserRepos(username),
      getUserPublicOrgs(username),
    ])

    const orgLogins = orgs.map((o) => o.login)
    const orgRepoLists = await Promise.all(
      orgLogins.map((org) => getOrgRepos(org)),
    )

    const allRepos = [...new Set([...userRepos, ...orgRepoLists.flat()])]
    return { repos: allRepos, orgs: orgLogins }
  }
}

/**
 * Fetch detailed per-file diff for a single commit.
 * Used to apply line-type exclusions to aggregate stats.
 */
async function getCommitDetails(
  repo: string,
  sha: string,
  token?: string,
): Promise<{ additions: number; deletions: number; files: { filename: string; additions: number; deletions: number }[] } | null> {
  try {
    const data = await ghFetch(`/repos/${repo}/commits/${sha}`, token)
    if (!data) return null
    return {
      additions: data.stats?.additions || 0,
      deletions: data.stats?.deletions || 0,
      files: (data.files || []).map((f: any) => ({
        filename: f.filename || '',
        additions: f.additions || 0,
        deletions: f.deletions || 0,
      })),
    }
  } catch {
    return null
  }
}

export interface GetRepoCommitsOptions {
  maxCommits?: number
  exclusions?: string[]
}

/**
 * Fetch recent commits by a specific author from a repo.
 * Returns up to `maxCommits` commits with messages for AI detection.
 * When `exclusions` are provided, per-commit file diffs are fetched so
 * excluded-file line changes can be subtracted from aggregate stats.
 */
export async function getRepoCommits(
  repo: string,
  authorLogin: string,
  token?: string,
  opts: number | GetRepoCommitsOptions = 100,
): Promise<CommitInfo[]> {
  const options: GetRepoCommitsOptions = typeof opts === 'number' ? { maxCommits: opts } : opts
  const maxCommits = options.maxCommits ?? 100
  const exclusions = options.exclusions ?? []
  const includeFileDiffs = exclusions.length > 0
  const commits: CommitInfo[] = []
  let page = 1
  const perPage = Math.min(maxCommits, 100)

  while (commits.length < maxCommits) {
    try {
      const data = await ghFetch(
        `/repos/${repo}/commits?author=${authorLogin}&per_page=${perPage}&page=${page}`,
        token,
      )
      if (!data || !Array.isArray(data) || data.length === 0) break

      for (const c of data) {
        const commit: CommitInfo = {
          repo,
          sha: c.sha,
          message: c.commit?.message || '',
          date: c.commit?.author?.date || c.commit?.committer?.date || '',
          authorLogin: c.author?.login || null,
          authorName: c.commit?.author?.name || '',
          authorEmail: c.commit?.author?.email || '',
        }
        commits.push(commit)
        if (commits.length >= maxCommits) break
      }

      if (data.length < perPage) break
      page++
    } catch {
      break
    }
  }

  if (includeFileDiffs && commits.length > 0) {
    const details = await Promise.all(
      commits.map((c) => getCommitDetails(repo, c.sha, token)),
    )
    for (let i = 0; i < commits.length; i++) {
      const detail = details[i]
      if (!detail) continue
      const commit = commits[i]
      let excludedAdditions = 0
      let excludedDeletions = 0
      for (const file of detail.files) {
        if (matchesExclusion(file.filename, exclusions)) {
          excludedAdditions += file.additions
          excludedDeletions += file.deletions
        }
      }
      commit.additions = detail.additions
      commit.deletions = detail.deletions
      commit.excludedAdditions = excludedAdditions
      commit.excludedDeletions = excludedDeletions
    }
  }

  return commits
}

// ─────────────────── GraphQL contribution calendar ───────────────────

const CONTRIB_QUERY = /* GraphQL */ `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays { date contributionCount }
          }
        }
      }
    }
  }
`

/**
 * Fetch real daily contribution counts via GraphQL contribution calendar.
 * GitHub limits ~1 year per query, so we fetch year-by-year.
 * Returns a flat list of { date, count } for all days with contributions > 0.
 *
 * With token: calls GraphQL directly.
 * Without token: routes through /api/gh POST proxy.
 */
export async function getContributionCalendar(
  login: string,
  token?: string,
  yearsBack = 3,
): Promise<ContributionDay[]> {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)

  const days: ContributionDay[] = []

  for (let y = 0; y < yearsBack; y++) {
    const to = new Date(now.getTime() - y * 365 * 24 * 3600 * 1000)
    const from = new Date(to.getTime() - 365 * 24 * 3600 * 1000)

    const variables = { login, from: from.toISOString(), to: to.toISOString() }

    try {
      const data = await withRetry(`contributions ${login} y${y}`, async () => {
        let resp: Response
        if (token) {
          resp = await fetch(`${API_BASE}/graphql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query: CONTRIB_QUERY, variables }),
          })
        } else {
          resp = await fetch(`${PROXY_BASE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: CONTRIB_QUERY, variables }),
          })
        }

        updateRateLimit(resp)
        if (!resp.ok) {
          const err = new Error(`GraphQL ${resp.status}: ${await resp.text()}`) as any
          err.status = resp.status
          err.response = { headers: Object.fromEntries(resp.headers.entries()) }
          throw err
        }
        return resp.json()
      })

      const weeks = data?.data?.user?.contributionsCollection?.contributionCalendar?.weeks
      if (!weeks) continue

      for (const wk of weeks) {
        for (const d of wk.contributionDays) {
          if (d.contributionCount > 0) {
            days.push({ date: d.date, count: d.contributionCount })
          }
        }
      }
    } catch {
      // Non-fatal — partial data is better than none
      continue
    }
  }

  return days
}

// ─────────────────── commit quality ───────────────────

const TRIVIAL_MSG =
  /^(?:wip|tmp|temp|asdf|test|fix|update|updates?|minor(?:\s+update)?|typo|fix(?:ed)?\s+typo|stuff|things|merge\s+branch|initial\s+commit|init|commit|save|progress|work|y|\.{2,}|[a-z]{1,3}|updated?\s+readme)\s*$/i

const MEANINGFUL_VERB =
  /^(?:feat|fix|refactor|docs?|test|perf|chore|style|ci|build|revert|add(?:s|ed)?|remove[sd]?|implement|introduce|handle|prevent|enable|disable|migrate|rename|move|extract|inline|bump|upgrade|downgrade|close|resolve)[\s(:-]/i

/**
 * Compute commit message quality from already-fetched commit messages.
 * Returns avg length, meaningful ratio, and counts.
 */
export function computeCommitQuality(commits: CommitInfo[]): {
  avgMsgLen: number
  meaningfulRatio: number
  sampled: number
  trivialCount: number
  meaningfulCount: number
} {
  const msgs = commits
    .map((c) => c.message.split('\n')[0].trim())
    .filter((m) => m.length > 0)

  const sampled = msgs.length
  if (sampled === 0) {
    return { avgMsgLen: 0, meaningfulRatio: 0, sampled: 0, trivialCount: 0, meaningfulCount: 0 }
  }

  const totalLen = msgs.reduce((s, m) => s + m.length, 0)
  const avgMsgLen = Math.round(totalLen / sampled)

  let meaningfulCount = 0
  let trivialCount = 0
  for (const m of msgs) {
    if (TRIVIAL_MSG.test(m)) {
      trivialCount++
    } else if (MEANINGFUL_VERB.test(m) || m.length >= 30) {
      meaningfulCount++
    } else {
      trivialCount++
    }
  }

  return {
    avgMsgLen,
    meaningfulRatio: meaningfulCount / sampled,
    sampled,
    trivialCount,
    meaningfulCount,
  }
}

// ─────────────────── GraphQL helper ───────────────────

/**
 * Run a GraphQL query, routing through PROXY_BASE (no token) or API_BASE/graphql (token).
 * Handles empty bodies via resp.text() + JSON.parse. Retries via withRetry.
 */
async function graphqlPost(
  label: string,
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<any> {
  return withRetry(label, async () => {
    let resp: Response
    if (token) {
      resp = await fetch(`${API_BASE}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
      })
    } else {
      resp = await fetch(`${PROXY_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      })
    }

    updateRateLimit(resp)
    if (resp.status === 404) return null
    if (resp.status === 202) return null
    if (!resp.ok) {
      const err = new Error(`GraphQL ${resp.status}: ${await resp.text()}`) as any
      err.status = resp.status
      err.response = { headers: Object.fromEntries(resp.headers.entries()) }
      throw err
    }
    const text = await resp.text()
    if (!text) return null
    return JSON.parse(text)
  })
}

// ─────────────────── user profile ───────────────────

export async function getUserProfile(username: string, token?: string): Promise<UserProfile> {
  const data = await ghFetch(`/users/${username}`, token)
  if (!data) throw new GitHubApiError(`User "${username}" not found`, 'not_found')
  return {
    login: data.login,
    name: data.name,
    bio: data.bio,
    company: data.company,
    location: data.location,
    avatarUrl: data.avatar_url,
    followers: data.followers,
    following: data.following,
    createdAt: data.created_at,
    publicRepos: data.public_repos,
    hireable: data.hireable || false,
    blog: data.blog || null,
  }
}

// ─────────────────── repo metadata ───────────────────

function mapRepoMeta(r: any): RepoMetadata {
  return {
    fullName: r.full_name,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    openIssues: r.open_issues_count ?? 0,
    primaryLanguage: r.language ?? null,
    topics: [], // not available in list response; skip to avoid N extra calls
    license: r.license?.spdx_id ?? null,
    isFork: r.fork ?? false,
    isArchived: r.archived ?? false,
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
    description: r.description ?? null,
  }
}

/**
 * Get public repos for any user with full metadata (no OAuth needed).
 */
export async function getPublicUserReposWithMeta(
  username: string,
  token?: string,
): Promise<RepoMetadata[]> {
  const repos: RepoMetadata[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(
      `/users/${username}/repos?per_page=100&page=${page}&sort=pushed&type=public`,
      token,
    )
    if (!batch || !Array.isArray(batch) || batch.length === 0) break
    for (const r of batch) repos.push(mapRepoMeta(r))
    if (batch.length < 100) break
    page++
  }
  return repos
}

/**
 * Get repos owned by the authenticated user with full metadata (requires OAuth).
 */
export async function getUserReposWithMeta(token: string): Promise<RepoMetadata[]> {
  const repos: RepoMetadata[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(
      `/user/repos?per_page=100&page=${page}&affiliation=owner&sort=pushed`,
      token,
    )
    if (!batch || !Array.isArray(batch) || batch.length === 0) break
    for (const r of batch) repos.push(mapRepoMeta(r))
    if (batch.length < 100) break
    page++
  }
  return repos
}

// ─────────────────── contribution type totals (GraphQL) ───────────────────

const CONTRIB_TYPES_QUERY = /* GraphQL */ `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
      }
    }
  }
`

export async function getContributionTypes(
  login: string,
  token?: string,
  yearsBack = 3,
): Promise<ContributionTypes> {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)

  const totals: ContributionTypes = {
    commits: 0,
    pullRequests: 0,
    issues: 0,
    pullRequestReviews: 0,
    repositories: 0,
  }

  for (let y = 0; y < yearsBack; y++) {
    const to = new Date(now.getTime() - y * 365 * 24 * 3600 * 1000)
    const from = new Date(to.getTime() - 365 * 24 * 3600 * 1000)
    const variables = { login, from: from.toISOString(), to: to.toISOString() }

    try {
      const data = await graphqlPost(
        `contrib-types ${login} y${y}`,
        CONTRIB_TYPES_QUERY,
        variables,
        token,
      )
      const c = data?.data?.user?.contributionsCollection
      if (!c) continue
      totals.commits += c.totalCommitContributions ?? 0
      totals.pullRequests += c.totalPullRequestContributions ?? 0
      totals.issues += c.totalIssueContributions ?? 0
      totals.pullRequestReviews += c.totalPullRequestReviewContributions ?? 0
      totals.repositories += c.totalRepositoryContributions ?? 0
    } catch {
      continue
    }
  }

  return totals
}

// ─────────────────── PRs (GraphQL, paginated) ───────────────────

const PR_QUERY = /* GraphQL */ `
  query ($login: String!, $first: Int!, $after: String) {
    user(login: $login) {
      pullRequests(first: $first, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          repository { nameWithOwner }
          number
          title
          state
          merged
          mergedAt
          closedAt
          createdAt
          additions
          deletions
          changedFiles
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

export async function getUserPRs(
  login: string,
  token?: string,
  maxPRs = 100,
): Promise<PRInfo[]> {
  const prs: PRInfo[] = []
  let after: string | null = null
  const first = Math.min(maxPRs, 100)

  while (prs.length < maxPRs) {
    try {
      const variables: Record<string, unknown> = { login, first, after }
      const data = await graphqlPost(`prs ${login}`, PR_QUERY, variables, token)
      const pr = data?.data?.user?.pullRequests
      if (!pr) break

      for (const n of pr.nodes || []) {
        let state: PRInfo['state'] = 'open'
        if (n.merged === true) state = 'merged'
        else if (n.state === 'CLOSED') state = 'closed'
        else if (n.state === 'OPEN') state = 'open'

        prs.push({
          repo: n.repository?.nameWithOwner ?? '',
          number: n.number,
          title: n.title ?? '',
          state,
          createdAt: n.createdAt,
          mergedAt: n.mergedAt ?? null,
          closedAt: n.closedAt ?? null,
          additions: n.additions ?? 0,
          deletions: n.deletions ?? 0,
          changedFiles: n.changedFiles ?? 0,
        })
        if (prs.length >= maxPRs) break
      }

      if (!pr.pageInfo?.hasNextPage) break
      after = pr.pageInfo.endCursor
    } catch {
      break
    }
  }

  return prs
}

// ─────────────────── Issues (GraphQL, paginated) ───────────────────

const ISSUE_QUERY = /* GraphQL */ `
  query ($login: String!, $first: Int!, $after: String) {
    user(login: $login) {
      issues(first: $first, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          repository { nameWithOwner }
          number
          title
          state
          createdAt
          closedAt
          labels(first: 10) { nodes { name } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

export async function getUserIssues(
  login: string,
  token?: string,
  maxIssues = 100,
): Promise<IssueInfo[]> {
  const issues: IssueInfo[] = []
  let after: string | null = null
  const first = Math.min(maxIssues, 100)

  while (issues.length < maxIssues) {
    try {
      const variables: Record<string, unknown> = { login, first, after }
      const data = await graphqlPost(`issues ${login}`, ISSUE_QUERY, variables, token)
      const iss = data?.data?.user?.issues
      if (!iss) break

      for (const n of iss.nodes || []) {
        const labels: string[] = (n.labels?.nodes || []).map((l: any) => l.name).filter(Boolean)
        issues.push({
          repo: n.repository?.nameWithOwner ?? '',
          number: n.number,
          title: n.title ?? '',
          state: n.state === 'CLOSED' ? 'closed' : 'open',
          createdAt: n.createdAt,
          closedAt: n.closedAt ?? null,
          labels,
        })
        if (issues.length >= maxIssues) break
      }

      if (!iss.pageInfo?.hasNextPage) break
      after = iss.pageInfo.endCursor
    } catch {
      break
    }
  }

  return issues
}

// ─────────────────── starred repos ───────────────────

export async function getStarredRepos(
  username: string,
  token?: string,
  maxRepos = 100,
): Promise<StarredRepo[]> {
  const repos: StarredRepo[] = []
  let page = 1
  const perPage = Math.min(maxRepos, 100)

  while (repos.length < maxRepos) {
    try {
      const batch = await ghFetch(
        `/users/${username}/starred?per_page=${perPage}&page=${page}`,
        token,
      )
      if (!batch || !Array.isArray(batch) || batch.length === 0) break
      for (const r of batch) {
        repos.push({
          fullName: r.full_name,
          language: r.language ?? null,
          stars: r.stargazers_count ?? 0,
          description: r.description ?? null,
        })
        if (repos.length >= maxRepos) break
      }
      if (batch.length < perPage) break
      page++
    } catch {
      break
    }
  }

  return repos
}

// ─────────────────── activity events ───────────────────

function summarizeEvent(type: string, payload: any, repo: string): string {
  switch (type) {
    case 'PushEvent': {
      const n = payload?.commits?.length ?? 0
      return `Pushed ${n} commit${n === 1 ? '' : 's'} to ${repo}`
    }
    case 'CreateEvent':
      return `Created ${payload?.ref_type ?? 'resource'} in ${repo}`
    case 'DeleteEvent':
      return `Deleted ${payload?.ref_type ?? 'resource'} in ${repo}`
    case 'ForkEvent':
      return `Forked ${repo}`
    case 'WatchEvent':
      return `Starred ${repo}`
    case 'PullRequestEvent':
      return `${payload?.action ?? 'Updated'} a pull request in ${repo}`
    case 'IssueCommentEvent':
      return `Commented on an issue in ${repo}`
    case 'IssuesEvent':
      return `${payload?.action ?? 'Updated'} an issue in ${repo}`
    case 'PullRequestReviewEvent':
      return `Reviewed a pull request in ${repo}`
    case 'PullRequestReviewCommentEvent':
      return `Commented on a PR review in ${repo}`
    case 'CommitCommentEvent':
      return `Commented on a commit in ${repo}`
    case 'ReleaseEvent':
      return `Published a release in ${repo}`
    case 'MemberEvent':
      return `Added a member to ${repo}`
    case 'PublicEvent':
      return `Made ${repo} public`
    case 'GollumEvent': {
      const n = payload?.pages?.length ?? 0
      return `Updated ${n} wiki page${n === 1 ? '' : 's'} in ${repo}`
    }
    default:
      return `${type} in ${repo}`
  }
}

export async function getUserEvents(
  username: string,
  token?: string,
  maxEvents = 30,
): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = []
  try {
    const batch = await ghFetch(
      `/users/${username}/events?per_page=${Math.min(maxEvents, 30)}&page=1`,
      token,
    )
    if (!batch || !Array.isArray(batch)) return events
    for (const e of batch) {
      const repo = e.repo?.name ?? ''
      events.push({
        type: e.type ?? '',
        repo,
        createdAt: e.created_at ?? '',
        summary: summarizeEvent(e.type ?? '', e.payload, repo),
      })
      if (events.length >= maxEvents) break
    }
  } catch {
    // non-fatal
  }
  return events
}

// ─────────────────── punch card ───────────────────

export async function getPunchCard(repo: string, token?: string): Promise<PunchCardData[]> {
  try {
    const data = await ghFetch(`/repos/${repo}/stats/punch_card`, token)
    // 202 (computing) and 404 (not found) both return null from ghFetch
    if (!data || !Array.isArray(data)) return []
    return data.map((t: any) => ({
      day: t[0],
      hour: t[1],
      commits: t[2],
    }))
  } catch {
    return []
  }
}
