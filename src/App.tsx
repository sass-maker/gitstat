import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { RepoStats, OrgStats, GrandTotals, FetchProgress, RateLimitInfo, CachedResults, MonthlyData, DayData, SummaryStats, LanguageStat, CommitInfo, AIInvolvementStats, ChurnStats, CommitPatterns, ContributionDay, UserProfile, RepoMetadata, ContributionTypes, PRInfo, PRStats, IssueInfo, IssueStats, StarredRepo, StarredStats, ActivityEvent, TimePatterns, ConventionalCommitBreakdown, CollaborationStats, KeywordStats, GapAnalysis, RepoMetadataStats } from './types'
import { getContributorStats, getAllRepos, getUser, getUserProfile, getRateLimitInfo, getRepoLanguages, getRepoCommits, getContributionCalendar, getContributionTypes, getUserPRs, getUserIssues, getStarredRepos, getUserEvents, getPublicUserReposWithMeta, computeCommitQuality, GitHubApiError } from './lib/github'
import { requestDeviceCode, pollForToken, getStoredToken, storeToken, clearToken } from './lib/oauth'
import { computeMonthlyData, computeDailyData, computeDailyDataFromCalendar, computeSummaryStats, computeLanguageStats, computeAIInvolvement, computeChurnStats, computeCommitPatterns, computeTimePatterns, computeConventionalBreakdown, computeCollaboration, computeKeywordStats, computeGapAnalysis, computePRStats, computeIssueStats, computeStarredStats, computeRepoMetadataStats } from './lib/analytics'
import { Heatmap } from './components/Heatmap'
import { MonthlyChart } from './components/MonthlyChart'
import { SummaryStatsCard } from './components/SummaryStats'
import { LanguageBreakdown } from './components/LanguageBreakdown'
import { ChurnPanel } from './components/ChurnPanel'
import { AIPanel } from './components/AIPanel'
import { PatternsPanel } from './components/PatternsPanel'
import { ProfileCard } from './components/ProfileCard'
import { ContributionTypeChart } from './components/ContributionTypeChart'
import { TimePatternsPanel } from './components/TimePatternsPanel'
import { ConventionalCommitChart } from './components/ConventionalCommitChart'
import { CollaborationPanel } from './components/CollaborationPanel'
import { KeywordCloud } from './components/KeywordCloud'
import { PRPanel } from './components/PRPanel'
import { IssuePanel } from './components/IssuePanel'
import { StarredPanel } from './components/StarredPanel'
import { GapAnalysisPanel } from './components/GapAnalysisPanel'
import './App.css'

type AppState = 'idle' | 'auth' | 'fetching' | 'done' | 'error'
type Tab = 'overview' | 'activity' | 'churn' | 'ai' | 'patterns' | 'prs' | 'issues' | 'repos' | 'taste'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeUntilReset(reset: number): string {
  const seconds = reset - Math.floor(Date.now() / 1000)
  if (seconds <= 0) return 'now'
  const mins = Math.ceil(seconds / 60)
  return `${mins}m`
}

const CACHE_KEY = 'gitstat_cache'
const CACHE_TTL = 60 * 60 * 1000

function loadCache(username: string): CachedResults | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedResults = JSON.parse(raw)
    if (cached.username !== username) return null
    if (Date.now() - cached.fetchedAt > CACHE_TTL) return null
    return cached
  } catch {
    return null
  }
}

function saveCache(results: CachedResults) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(results))
}

export default function App() {
  const [state, setState] = useState<AppState>('idle')
  const [tab, setTab] = useState<Tab>('overview')
  const [username, setUsername] = useState('')
  const [token, setToken] = useState<string | null>(getStoredToken())
  const [deviceCode, setDeviceCode] = useState<{ userCode: string; uri: string } | null>(null)
  const [progress, setProgress] = useState<FetchProgress | null>(null)
  const [repoStats, setRepoStats] = useState<RepoStats[]>([])
  const [orgStats, setOrgStats] = useState<OrgStats[]>([])
  const [totals, setTotals] = useState<GrandTotals | null>(null)
  const [error, setError] = useState<string>('')
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [sortBy, setSortBy] = useState<'commits' | 'additions' | 'deletions' | 'net' | 'repo'>('commits')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [fromCache, setFromCache] = useState(false)
  const [fetchingLangs, setFetchingLangs] = useState(false)
  const [fetchingCommits, setFetchingCommits] = useState(false)
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [contributionDays, setContributionDays] = useState<ContributionDay[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [repoMeta, setRepoMeta] = useState<RepoMetadata[]>([])
  const [contribTypes, setContribTypes] = useState<ContributionTypes | null>(null)
  const [prs, setPRs] = useState<PRInfo[]>([])
  const [issues, setIssues] = useState<IssueInfo[]>([])
  const [starred, setStarred] = useState<StarredRepo[]>([])
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [fetchingExtra, setFetchingExtra] = useState(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const info = getRateLimitInfo()
      if (info) setRateLimit(info)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const monthlyData: MonthlyData[] = useMemo(() => computeMonthlyData(repoStats), [repoStats])
  const dailyData: Map<string, DayData> = useMemo(
    () => contributionDays.length > 0
      ? computeDailyDataFromCalendar(contributionDays)
      : computeDailyData(repoStats),
    [repoStats, contributionDays],
  )
  const summaryStats: SummaryStats = useMemo(
    () => computeSummaryStats(repoStats, monthlyData, dailyData),
    [repoStats, monthlyData, dailyData],
  )
  const languageStats: LanguageStat[] = useMemo(() => computeLanguageStats(repoStats), [repoStats])
  const churnStats: ChurnStats = useMemo(() => computeChurnStats(repoStats), [repoStats])
  const commitQuality = useMemo(
    () => commits.length > 0 ? computeCommitQuality(commits) : undefined,
    [commits],
  )
  const commitPatterns: CommitPatterns = useMemo(
    () => computeCommitPatterns(repoStats, commitQuality),
    [repoStats, commitQuality],
  )
  const aiStats: AIInvolvementStats | null = useMemo(
    () => commits.length > 0 ? computeAIInvolvement(commits) : null,
    [commits],
  )
  const timePatterns: TimePatterns | null = useMemo(
    () => commits.length > 0 ? computeTimePatterns(commits) : null,
    [commits],
  )
  const conventionalBreakdown: ConventionalCommitBreakdown | null = useMemo(
    () => commits.length > 0 ? computeConventionalBreakdown(commits) : null,
    [commits],
  )
  const collaborationStats: CollaborationStats | null = useMemo(
    () => commits.length > 0 ? computeCollaboration(commits) : null,
    [commits],
  )
  const keywordStats: KeywordStats | null = useMemo(
    () => commits.length > 0 ? computeKeywordStats(commits) : null,
    [commits],
  )
  const gapAnalysis: GapAnalysis | null = useMemo(
    () => computeGapAnalysis(dailyData),
    [dailyData],
  )
  const prStats: PRStats | null = useMemo(
    () => prs.length > 0 ? computePRStats(prs) : null,
    [prs],
  )
  const issueStats: IssueStats | null = useMemo(
    () => issues.length > 0 ? computeIssueStats(issues) : null,
    [issues],
  )
  const starredStats: StarredStats | null = useMemo(
    () => starred.length > 0 ? computeStarredStats(starred) : null,
    [starred],
  )
  const repoMetaStats: RepoMetadataStats | null = useMemo(
    () => repoMeta.length > 0 ? computeRepoMetadataStats(repoMeta) : null,
    [repoMeta],
  )
  const repoMetaMap = useMemo(() => {
    const m = new Map<string, RepoMetadata>()
    for (const r of repoMeta) m.set(r.fullName, r)
    return m
  }, [repoMeta])

  const handleAuth = useCallback(async () => {
    setState('auth')
    setError('')
    try {
      const code = await requestDeviceCode()
      setDeviceCode({ userCode: code.user_code, uri: code.verification_uri })
      const tokenResp = await pollForToken(code.device_code, code.interval)
      storeToken(tokenResp.access_token)
      setToken(tokenResp.access_token)
      setDeviceCode(null)
      setState('idle')
    } catch (e: any) {
      setError(e.message || 'Authentication failed')
      setState('error')
      setDeviceCode(null)
    }
  }, [])

  const handleCancel = useCallback(() => {
    cancelRef.current = true
  }, [])

  const handleLogout = useCallback(() => {
    clearToken()
    setToken(null)
    setState('idle')
  }, [])

  const handleFetch = useCallback(async (force = false) => {
    if (!username.trim()) return
    setError('')

    if (!force) {
      const cached = loadCache(username.trim())
      if (cached) {
        setRepoStats(cached.repoStats)
        setOrgStats(cached.orgStats)
        setTotals(cached.totals)
        setFromCache(true)
        setState('done')
        return
      }
    }

    setState('fetching')
    setFromCache(false)
    cancelRef.current = false

    try {
      const user = await getUser(username.trim(), token || undefined)
      if (!user) {
        setError(`User "${username.trim()}" not found on GitHub.`)
        setState('error')
        return
      }

      const { repos } = await getAllRepos(username.trim(), token || undefined)
      setProgress({ total: repos.length, processed: 0, skipped: 0, current: '' })

      const results: RepoStats[] = []
      let processed = 0
      let skipped = 0

      const batchSize = 10
      for (let i = 0; i < repos.length; i += batchSize) {
        if (cancelRef.current) break
        const batch = repos.slice(i, i + batchSize)
        await Promise.all(
          batch.map((repo) =>
            getContributorStats(repo, username.trim(), token || undefined).then((r) => {
              if (r) results.push(r)
              else skipped++
              processed++
              return r
            }),
          ),
        )
        setProgress({
          total: repos.length,
          processed,
          skipped,
          current: batch[batch.length - 1] || '',
        })
        setRepoStats([...results].sort((a, b) => b.commits - a.commits))
      }

      // If cancelled, show partial results
      if (cancelRef.current) {
        const partialOrgMap: Record<string, OrgStats> = {}
        for (const r of results) {
          const org = r.repo.split('/')[0]
          if (!partialOrgMap[org]) {
            partialOrgMap[org] = { org, repos: 0, commits: 0, additions: 0, deletions: 0, net: 0 }
          }
          partialOrgMap[org].repos++
          partialOrgMap[org].commits += r.commits
          partialOrgMap[org].additions += r.additions
          partialOrgMap[org].deletions += r.deletions
          partialOrgMap[org].net += r.additions - r.deletions
        }
        const partialOrgs = Object.values(partialOrgMap).sort((a, b) => b.commits - a.commits)
        const partialTotals: GrandTotals = {
          repos: results.length,
          commits: results.reduce((s, r) => s + r.commits, 0),
          additions: results.reduce((s, r) => s + r.additions, 0),
          deletions: results.reduce((s, r) => s + r.deletions, 0),
          net: results.reduce((s, r) => s + r.additions - r.deletions, 0),
        }
        setOrgStats(partialOrgs)
        setTotals(partialTotals)
        setProgress(null)
        setState('done')
        return
      }

      const orgMap: Record<string, OrgStats> = {}
      for (const r of results) {
        const org = r.repo.split('/')[0]
        if (!orgMap[org]) {
          orgMap[org] = { org, repos: 0, commits: 0, additions: 0, deletions: 0, net: 0 }
        }
        orgMap[org].repos++
        orgMap[org].commits += r.commits
        orgMap[org].additions += r.additions
        orgMap[org].deletions += r.deletions
        orgMap[org].net += r.additions - r.deletions
      }
      const orgsArr = Object.values(orgMap).sort((a, b) => b.commits - a.commits)

      const grandTotals: GrandTotals = {
        repos: results.length,
        commits: results.reduce((s, r) => s + r.commits, 0),
        additions: results.reduce((s, r) => s + r.additions, 0),
        deletions: results.reduce((s, r) => s + r.deletions, 0),
        net: results.reduce((s, r) => s + r.additions - r.deletions, 0),
      }

      setRepoStats([...results].sort((a, b) => b.commits - a.commits))
      setOrgStats(orgsArr)
      setTotals(grandTotals)
      setProgress(null)

      saveCache({
        username: username.trim(),
        fetchedAt: Date.now(),
        repoStats: results,
        orgStats: orgsArr,
        totals: grandTotals,
      })

      setState('done')

      // Fetch languages in background
      setFetchingLangs(true)
      const reposWithLangs = [...results]
      for (let i = 0; i < reposWithLangs.length; i += batchSize) {
        const batch = reposWithLangs.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (repo, j) => {
            const langs = await getRepoLanguages(repo.repo, token || undefined)
            reposWithLangs[i + j].languages = langs
          }),
        )
        setRepoStats([...reposWithLangs].sort((a, b) => b.commits - a.commits))
        saveCache({
          username: username.trim(),
          fetchedAt: Date.now(),
          repoStats: reposWithLangs,
          orgStats: orgsArr,
          totals: grandTotals,
        })
      }
      setFetchingLangs(false)

      // Fetch commits for AI detection in background
      // Only fetch for repos where the user has commits, limit to top 50 by commit count
      setFetchingCommits(true)
      const reposForCommits = [...results].sort((a, b) => b.commits - a.commits).slice(0, 50)
      const allCommits: CommitInfo[] = []
      for (let i = 0; i < reposForCommits.length; i += batchSize) {
        if (cancelRef.current) break
        const batch = reposForCommits.slice(i, i + batchSize)
        const batchCommits = await Promise.all(
          batch.map((r) => getRepoCommits(r.repo, username.trim(), token || undefined, 100)),
        )
        for (const cs of batchCommits) {
          allCommits.push(...cs)
        }
        setCommits([...allCommits])
      }
      setFetchingCommits(false)

      // Fetch real daily contribution calendar for accurate heatmap
      // This runs in parallel with commit fetching, but we start it here
      // to not block the initial stats. GraphQL gives actual daily counts.
      if (!cancelRef.current) {
        getContributionCalendar(username.trim(), token || undefined, 3)
          .then((days) => setContributionDays(days))
          .catch(() => { /* non-fatal — falls back to weekly approximation */ })
      }

      // Fetch extended data in background: profile, PRs, issues, starred repos,
      // contribution types, repo metadata, events. All non-fatal.
      if (!cancelRef.current) {
        setFetchingExtra(true)
        const u = username.trim()
        const t = token || undefined
        Promise.allSettled([
          getUserProfile(u, t).then(setProfile),
          getContributionTypes(u, t, 3).then(setContribTypes),
          getUserPRs(u, t, 100).then(setPRs),
          getUserIssues(u, t, 100).then(setIssues),
          getStarredRepos(u, t, 100).then(setStarred),
          getUserEvents(u, t, 30).then(setEvents),
          getPublicUserReposWithMeta(u, t).then(setRepoMeta),
        ]).then(() => setFetchingExtra(false))
      }
    } catch (e: any) {
      const msg = e instanceof GitHubApiError ? e.message : (e.message || 'Failed to fetch stats')
      setError(msg)
      setState('error')
      setProgress(null)
      setFetchingLangs(false)
      setFetchingCommits(false)
      setFetchingExtra(false)
    }
  }, [username, token])

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const sortedRepos = [...repoStats].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'repo') cmp = a.repo.localeCompare(b.repo)
    else if (sortBy === 'net') cmp = (a.additions - a.deletions) - (b.additions - b.deletions)
    else cmp = a[sortBy] - b[sortBy]
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight text-zinc-100">
            gitstat
          </h1>
          <div className="flex items-center gap-4">
            {rateLimit && (
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  rateLimit.remaining < rateLimit.limit * 0.2 ? 'text-amber-400' : 'text-zinc-400'
                }`}
                title={rateLimit.remaining < rateLimit.limit * 0.2 ? 'Rate limit low — fetch may fail' : undefined}
              >
                {rateLimit.remaining}/{rateLimit.limit}
                {rateLimit.remaining < rateLimit.limit && ` · ${timeUntilReset(rateLimit.reset)}`}
              </span>
            )}
            {token ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-emerald-400">authenticated</span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleAuth}
                disabled={state === 'auth'}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40"
                title="Connect for private repo access and your own 5,000 req/hr quota"
              >
                {state === 'auth' ? 'Waiting…' : 'Connect GitHub'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        {/* Input */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
            placeholder="GitHub username"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <button
            onClick={() => handleFetch()}
            disabled={!username.trim() || state === 'fetching'}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {state === 'fetching' ? 'Fetching…' : 'Get stats'}
          </button>
        </div>

        {/* Auth device code */}
        {deviceCode && (
          <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
            <p className="text-sm text-zinc-400 mb-2">Open this URL on any device:</p>
            <a
              href={deviceCode.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-base font-mono"
            >
              {deviceCode.uri}
            </a>
            <p className="text-sm text-zinc-400 mt-4 mb-2">Enter this code:</p>
            <p className="text-2xl font-mono font-bold tracking-[0.2em] text-zinc-100">{deviceCode.userCode}</p>
            <p className="text-[10px] text-zinc-400 mt-4">Waiting for authorization…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 bg-rose-950/50 border border-rose-900 rounded-lg p-3" role="alert" aria-live="assertive">
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="mb-6" aria-live="polite">
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>
                {progress.processed}/{progress.total} repos
                {progress.skipped > 0 && <span className="text-zinc-400"> · {progress.skipped} skipped</span>}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono tabular-nums">{Math.round((progress.processed / progress.total) * 100)}%</span>
                <button
                  onClick={handleCancel}
                  className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${(progress.processed / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1.5 truncate font-mono">{progress.current}</p>
          </div>
        )}

        {/* Results */}
        {state === 'done' && totals && (
          <div className="space-y-6">
            {fromCache && (
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>
                  Cached
                  {fetchingLangs && ' · loading languages…'}
                  {fetchingCommits && ' · scanning commits for AI…'}
                </span>
                <button
                  onClick={() => handleFetch(true)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Refresh
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-4 border-b border-zinc-800 overflow-x-auto" role="tablist" aria-label="Stats views">
              <TabButton id="tab-overview" active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabButton>
              <TabButton id="tab-activity" active={tab === 'activity'} onClick={() => setTab('activity')}>Activity</TabButton>
              <TabButton id="tab-churn" active={tab === 'churn'} onClick={() => setTab('churn')}>Churn</TabButton>
              <TabButton id="tab-ai" active={tab === 'ai'} onClick={() => setTab('ai')}>AI</TabButton>
              <TabButton id="tab-patterns" active={tab === 'patterns'} onClick={() => setTab('patterns')}>Patterns</TabButton>
              <TabButton id="tab-prs" active={tab === 'prs'} onClick={() => setTab('prs')}>PRs</TabButton>
              <TabButton id="tab-issues" active={tab === 'issues'} onClick={() => setTab('issues')}>Issues</TabButton>
              <TabButton id="tab-repos" active={tab === 'repos'} onClick={() => setTab('repos')}>Repos</TabButton>
              <TabButton id="tab-taste" active={tab === 'taste'} onClick={() => setTab('taste')}>Taste</TabButton>
            </div>

            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-6" role="tabpanel" id="tab-panel" aria-labelledby="tab-overview">
                {profile && <ProfileCard profile={profile} />}

                {/* Inline figures — not cards */}
                <div className="flex flex-wrap gap-x-8 gap-y-3 py-2">
                  <Figure label="Repos" value={totals.repos} />
                  <Figure label="Commits" value={totals.commits} />
                  <Figure label="Added" value={totals.additions} color="text-emerald-400" />
                  <Figure label="Deleted" value={totals.deletions} color="text-rose-400" />
                  <Figure
                    label="Net"
                    value={totals.net}
                    color={totals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                    signed
                  />
                </div>

                {contribTypes && <ContributionTypeChart types={contribTypes} />}

                {/* Per-org table */}
                {orgStats.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-zinc-300 mb-2">By organization</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-400">
                            <th className="text-left py-1.5 pr-4 font-normal">Org</th>
                            <th className="text-right py-1.5 px-3 font-normal">Repos</th>
                            <th className="text-right py-1.5 px-3 font-normal">Commits</th>
                            <th className="text-right py-1.5 px-3 font-normal">Added</th>
                            <th className="text-right py-1.5 px-3 font-normal">Deleted</th>
                            <th className="text-right py-1.5 pl-3 font-normal">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orgStats.map((o) => (
                            <tr key={o.org} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                              <td className="py-1.5 pr-4 text-blue-400">
                                <a href={`https://github.com/${o.org}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {o.org}
                                </a>
                              </td>
                              <td className="text-right py-1.5 px-3 text-zinc-400 tabular-nums">{o.repos}</td>
                              <td className="text-right py-1.5 px-3 tabular-nums">{o.commits.toLocaleString()}</td>
                              <td className="text-right py-1.5 px-3 text-emerald-400 font-mono tabular-nums">{formatNum(o.additions)}</td>
                              <td className="text-right py-1.5 px-3 text-rose-400 font-mono tabular-nums">{formatNum(o.deletions)}</td>
                              <td className={`text-right py-1.5 pl-3 font-mono tabular-nums ${o.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {o.net >= 0 ? '+' : ''}{formatNum(o.net)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activity */}
            {tab === 'activity' && (
              <div className="space-y-8" role="tabpanel" id="tab-panel" aria-labelledby="tab-activity">
                <section>
                  <h2 className="text-sm font-medium text-zinc-300 mb-3">Summary</h2>
                  <SummaryStatsCard stats={summaryStats} />
                </section>

                <section>
                  <h2 className="text-sm font-medium text-zinc-300 mb-3">Activity</h2>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <Heatmap dailyData={dailyData} />
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-medium text-zinc-300 mb-3">Monthly trends</h2>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <MonthlyChart monthlyData={monthlyData} />
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-medium text-zinc-300 mb-3">
                    Languages
                    {fetchingLangs && <span className="ml-2 text-[10px] text-blue-400">loading…</span>}
                  </h2>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    {languageStats.length > 0 ? (
                      <LanguageBreakdown languages={languageStats} />
                    ) : (
                      <p className="text-xs text-zinc-500">
                        {fetchingLangs ? 'Fetching language data…' : 'No language data available.'}
                      </p>
                    )}
                  </div>
                </section>

                {gapAnalysis && <GapAnalysisPanel analysis={gapAnalysis} />}
              </div>
            )}

            {/* Churn */}
            {tab === 'churn' && (
              <div role="tabpanel" id="tab-panel" aria-labelledby="tab-churn">
                <ChurnPanel stats={churnStats} />
              </div>
            )}

            {/* AI */}
            {tab === 'ai' && (
              <div role="tabpanel" id="tab-panel" aria-labelledby="tab-ai">
                <AIPanel stats={aiStats} loading={fetchingCommits} />
              </div>
            )}

            {/* Patterns */}
            {tab === 'patterns' && (
              <div role="tabpanel" id="tab-panel" aria-labelledby="tab-patterns">
                <PatternsPanel patterns={commitPatterns} />
                {timePatterns && <TimePatternsPanel patterns={timePatterns} />}
                {conventionalBreakdown && <ConventionalCommitChart breakdown={conventionalBreakdown} />}
                {collaborationStats && <CollaborationPanel stats={collaborationStats} />}
                {keywordStats && <KeywordCloud stats={keywordStats} />}
              </div>
            )}

            {/* PRs */}
            {tab === 'prs' && (
              <div role="tabpanel" id="tab-panel" aria-labelledby="tab-prs">
                {prStats ? (
                  <PRPanel stats={prStats} loading={fetchingExtra} />
                ) : (
                  <p className="text-xs text-zinc-500">
                    {fetchingExtra ? 'Fetching PR data…' : 'No PR data available.'}
                  </p>
                )}
              </div>
            )}

            {/* Issues */}
            {tab === 'issues' && (
              <div role="tabpanel" id="tab-panel" aria-labelledby="tab-issues">
                {issueStats ? (
                  <IssuePanel stats={issueStats} loading={fetchingExtra} />
                ) : (
                  <p className="text-xs text-zinc-500">
                    {fetchingExtra ? 'Fetching issue data…' : 'No issue data available.'}
                  </p>
                )}
              </div>
            )}

            {/* Repos */}
            {tab === 'repos' && (
              <div role="tabpanel" id="tab-panel" aria-labelledby="tab-repos">
                <h2 className="text-sm font-medium text-zinc-300 mb-2">
                  {sortedRepos.length} repos
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <SortableTh label="Repository" col="repo" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="left" />
                        <SortableTh label="Commits" col="commits" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Added" col="additions" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Deleted" col="deletions" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <SortableTh label="Net" col="net" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                        <th className="text-right py-1.5 px-3 font-normal">Stars</th>
                        <th className="text-right py-1.5 px-3 font-normal">Forks</th>
                        <th className="text-left py-1.5 pl-3 font-normal">Language</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRepos.map((r) => {
                        const net = r.additions - r.deletions
                        const meta = repoMetaMap.get(r.repo)
                        return (
                          <tr key={r.repo} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                            <td className="py-1.5 pr-4 text-blue-400">
                              <a href={`https://github.com/${r.repo}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {r.repo}
                              </a>
                            </td>
                            <td className="text-right py-1.5 px-3 tabular-nums">{r.commits.toLocaleString()}</td>
                            <td className="text-right py-1.5 px-3 text-emerald-400 font-mono tabular-nums">{formatNum(r.additions)}</td>
                            <td className="text-right py-1.5 px-3 text-rose-400 font-mono tabular-nums">{formatNum(r.deletions)}</td>
                            <td className={`text-right py-1.5 px-3 font-mono tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {net >= 0 ? '+' : ''}{formatNum(net)}
                            </td>
                            <td className="text-right py-1.5 px-3 text-amber-400 tabular-nums">
                              {meta ? meta.stars.toLocaleString() : '—'}
                            </td>
                            <td className="text-right py-1.5 px-3 text-zinc-400 tabular-nums">
                              {meta ? meta.forks.toLocaleString() : '—'}
                            </td>
                            <td className="py-1.5 pl-3 text-zinc-400">
                              {meta?.primaryLanguage || r.languages ? Object.keys(r.languages || {}).sort((a, b) => (r.languages![b] - r.languages![a]))[0] : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Taste */}
            {tab === 'taste' && (
              <div role="tabpanel" id="tab-panel" aria-labelledby="tab-taste">
                {starredStats ? (
                  <StarredPanel stats={starredStats} repoMetaStats={repoMetaStats} events={events} loading={fetchingExtra} />
                ) : (
                  <p className="text-xs text-zinc-500">
                    {fetchingExtra ? 'Fetching starred repos…' : 'No starred repo data available.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state — teaches the interface */}
        {state === 'idle' && !deviceCode && (
          <div className="py-16">
            <div className="text-center mb-8">
              <p className="text-base text-zinc-300 mb-1">Enter any GitHub username to see their commit footprint</p>
              <p className="text-sm text-zinc-400">Aggregate commits, lines changed, and analytics across all repos and orgs</p>
            </div>
            <div className="max-w-md mx-auto space-y-3">
              <Step n="1" text="Enter any GitHub username — no login required for public repos" />
              <Step n="2" text="Optionally connect your GitHub account for private repos and your own rate limit" />
              <Step n="3" text="Get totals, per-org breakdowns, activity heatmap, code churn, AI agent involvement, and commit patterns" />
            </div>
          </div>
        )}

        {/* Skeleton loading for activity tab while fetching */}
        {state === 'fetching' && tab === 'activity' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="skeleton h-3 w-16" />
                  <div className="skeleton h-4 w-20" />
                </div>
              ))}
            </div>
            <div className="skeleton h-32 w-full rounded-lg" />
            <div className="skeleton h-48 w-full rounded-lg" />
          </div>
        )}
      </main>
    </div>
  )
}

function Figure({ label, value, color = 'text-zinc-100', signed = false }: { label: string; value: number; color?: string; signed?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-400 mb-0.5">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${color}`}>
        {signed && value >= 0 ? '+' : ''}{value.toLocaleString()}
      </p>
    </div>
  )
}

function TabButton({ id, active, onClick, children }: { id: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls="tab-panel"
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault()
          const tabs = ['tab-overview', 'tab-activity', 'tab-churn', 'tab-ai', 'tab-patterns', 'tab-prs', 'tab-issues', 'tab-repos', 'tab-taste']
          const idx = tabs.indexOf(id)
          const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length
          document.getElementById(tabs[next])?.click()
          document.getElementById(tabs[next])?.focus()
        }
      }}
      className={`px-1 pb-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-blue-500 text-zinc-100'
          : 'border-transparent text-zinc-400 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex items-start gap-3 text-sm text-zinc-400">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] flex items-center justify-center font-mono">{n}</span>
      <span>{text}</span>
    </div>
  )
}

function SortableTh({
  label,
  col,
  sortBy,
  sortDir,
  onSort,
  align = 'right',
}: {
  label: string
  col: string
  sortBy: string
  sortDir: 'asc' | 'desc'
  onSort: (col: any) => void
  align?: 'left' | 'right'
}) {
  const active = sortBy === col
  return (
    <th
      onClick={() => onSort(col)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSort(col))}
      tabIndex={0}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      aria-label={`Sort by ${label}`}
      className={`py-1.5 px-3 font-normal cursor-pointer select-none hover:text-zinc-300 transition-colors ${align === 'left' ? 'text-left pr-4' : 'text-right'} ${active ? 'text-zinc-200' : ''}`}
    >
      {label}{active && <span className="ml-0.5 text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}
