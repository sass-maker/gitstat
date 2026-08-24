import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { RepoStats, OrgStats, GrandTotals, FetchProgress, RateLimitInfo, CachedResults, MonthlyData, DayData, SummaryStats, LanguageStat, CommitInfo, AIInvolvementStats, ChurnStats, CommitPatterns, ContributionDay, UserProfile, RepoMetadata, ContributionTypes, PRInfo, PRStats, IssueInfo, IssueStats, TimePatterns, ConventionalCommitBreakdown, CollaborationStats, KeywordStats, GapAnalysis } from './types'
import { getContributorStats, getAllRepos, getUser, getUserProfile, getRateLimitInfo, getRepoLanguages, getRepoCommits, getContributionCalendar, getContributionTypes, getUserPRs, getUserIssues, getPublicUserReposWithMeta, computeCommitQuality, GitHubApiError } from './lib/github'
import { computeMonthlyData, computeDailyData, computeDailyDataFromCalendar, computeSummaryStats, computeLanguageStats, computeAIInvolvement, computeChurnStats, computeCommitPatterns, computeTimePatterns, computeConventionalBreakdown, computeCollaboration, computeKeywordStats, computeGapAnalysis, computePRStats, computeIssueStats } from './lib/analytics'
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
import { GapAnalysisPanel } from './components/GapAnalysisPanel'
import { TimePeriodSelector } from './components/TimePeriodSelector'
import { ExclusionEditor } from './components/ExclusionEditor'
import {
  loadFilters,
  saveFilters,
  filterRepoStatsByPeriod,
  filterCommitsByPeriod,
  filterPRsByPeriod,
  filterIssuesByPeriod,
  filterContributionDays,
  applyExclusionsToRepoStats,
  type FilterSettings,
} from './lib/filters'
import './App.css'

type AppState = 'idle' | 'fetching' | 'done' | 'error'
type Tab = 'overview' | 'activity' | 'churn' | 'ai' | 'patterns' | 'prs' | 'issues' | 'repos'

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

function formatLastRefresh(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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
  const token: string | null = null
  const [progress, setProgress] = useState<FetchProgress | null>(null)
  const [repoStats, setRepoStats] = useState<RepoStats[]>([])
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
  const [fetchingExtra, setFetchingExtra] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [filters, setFilters] = useState<FilterSettings>(loadFilters)
  const cancelRef = useRef(false)
  const prevExclusionsRef = useRef<string[]>(filters.exclusions)

  useEffect(() => {
    saveFilters(filters)
  }, [filters])

  // Refetch sampled commits when file exclusions change so the dashboard
  // reflects the new filters without a full reload.
  useEffect(() => {
    if (state !== 'done' || !username.trim() || repoStats.length === 0) return
    if (JSON.stringify(prevExclusionsRef.current) === JSON.stringify(filters.exclusions)) return
    prevExclusionsRef.current = filters.exclusions

    const refetch = async () => {
      setFetchingCommits(true)
      try {
        const reposForCommits = [...repoStats].sort((a, b) => b.commits - a.commits).slice(0, 50)
        const allCommits: CommitInfo[] = []
        const batchSize = 10
        for (let i = 0; i < reposForCommits.length; i += batchSize) {
          if (cancelRef.current) break
          const batch = reposForCommits.slice(i, i + batchSize)
          const batchCommits = await Promise.all(
            batch.map((r) =>
              getRepoCommits(r.repo, username.trim(), token || undefined, {
                maxCommits: 100,
                exclusions: filters.exclusions,
              }),
            ),
          )
          for (const cs of batchCommits) allCommits.push(...cs)
          setCommits([...allCommits])
        }
      } finally {
        setFetchingCommits(false)
      }
    }
    refetch()
  }, [state, username, repoStats, token, filters.exclusions])

  useEffect(() => {
    const interval = setInterval(() => {
      const info = getRateLimitInfo()
      if (info) setRateLimit(info)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const exclusionAdjustedRepoStats = useMemo(
    () => applyExclusionsToRepoStats(repoStats, commits),
    [repoStats, commits],
  )
  const filteredRepoStats = useMemo(
    () => filterRepoStatsByPeriod(exclusionAdjustedRepoStats, filters.period),
    [exclusionAdjustedRepoStats, filters.period],
  )
  const filteredCommits = useMemo(
    () => filterCommitsByPeriod(commits, filters.period),
    [commits, filters.period],
  )
  const filteredContributionDays = useMemo(
    () => filterContributionDays(contributionDays, filters.period),
    [contributionDays, filters.period],
  )
  const filteredPRs = useMemo(
    () => filterPRsByPeriod(prs, filters.period),
    [prs, filters.period],
  )
  const filteredIssues = useMemo(
    () => filterIssuesByPeriod(issues, filters.period),
    [issues, filters.period],
  )

  const monthlyData: MonthlyData[] = useMemo(
    () => computeMonthlyData(filteredRepoStats),
    [filteredRepoStats],
  )
  const dailyData: Map<string, DayData> = useMemo(
    () => filteredContributionDays.length > 0
      ? computeDailyDataFromCalendar(filteredContributionDays)
      : computeDailyData(filteredRepoStats),
    [filteredRepoStats, filteredContributionDays],
  )
  const summaryStats: SummaryStats = useMemo(
    () => computeSummaryStats(filteredRepoStats, monthlyData, dailyData),
    [filteredRepoStats, monthlyData, dailyData],
  )
  const languageStats: LanguageStat[] = useMemo(
    () => computeLanguageStats(filteredRepoStats),
    [filteredRepoStats],
  )
  const churnStats: ChurnStats = useMemo(
    () => computeChurnStats(filteredRepoStats),
    [filteredRepoStats],
  )
  const commitQuality = useMemo(
    () => filteredCommits.length > 0 ? computeCommitQuality(filteredCommits) : undefined,
    [filteredCommits],
  )
  const commitPatterns: CommitPatterns = useMemo(
    () => computeCommitPatterns(filteredRepoStats, commitQuality),
    [filteredRepoStats, commitQuality],
  )
  const aiStats: AIInvolvementStats | null = useMemo(
    () => filteredCommits.length > 0 ? computeAIInvolvement(filteredCommits) : null,
    [filteredCommits],
  )
  const timePatterns: TimePatterns | null = useMemo(
    () => filteredCommits.length > 0 ? computeTimePatterns(filteredCommits) : null,
    [filteredCommits],
  )
  const conventionalBreakdown: ConventionalCommitBreakdown | null = useMemo(
    () => filteredCommits.length > 0 ? computeConventionalBreakdown(filteredCommits) : null,
    [filteredCommits],
  )
  const collaborationStats: CollaborationStats | null = useMemo(
    () => filteredCommits.length > 0 ? computeCollaboration(filteredCommits) : null,
    [filteredCommits],
  )
  const keywordStats: KeywordStats | null = useMemo(
    () => filteredCommits.length > 0 ? computeKeywordStats(filteredCommits) : null,
    [filteredCommits],
  )
  const gapAnalysis: GapAnalysis | null = useMemo(
    () => computeGapAnalysis(dailyData),
    [dailyData],
  )
  const prStats: PRStats | null = useMemo(
    () => filteredPRs.length > 0 ? computePRStats(filteredPRs) : null,
    [filteredPRs],
  )
  const issueStats: IssueStats | null = useMemo(
    () => filteredIssues.length > 0 ? computeIssueStats(filteredIssues) : null,
    [filteredIssues],
  )
  const filteredTotals: GrandTotals = useMemo(
    () => ({
      repos: filteredRepoStats.length,
      commits: filteredRepoStats.reduce((s, r) => s + r.commits, 0),
      additions: filteredRepoStats.reduce((s, r) => s + r.additions, 0),
      deletions: filteredRepoStats.reduce((s, r) => s + r.deletions, 0),
      net: filteredRepoStats.reduce((s, r) => s + r.additions - r.deletions, 0),
    }),
    [filteredRepoStats],
  )
  const filteredOrgStats: OrgStats[] = useMemo(() => {
    const orgMap: Record<string, OrgStats> = {}
    for (const r of filteredRepoStats) {
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
    return Object.values(orgMap).sort((a, b) => b.commits - a.commits)
  }, [filteredRepoStats])
  const repoMetaMap = useMemo(() => {
    const m = new Map<string, RepoMetadata>()
    for (const r of repoMeta) m.set(r.fullName, r)
    return m
  }, [repoMeta])

  const handleCancel = useCallback(() => {
    cancelRef.current = true
  }, [])

  const handleFetch = useCallback(async (force = false) => {
    if (!username.trim()) return
    setError('')

    if (!force) {
      const cached = loadCache(username.trim())
      if (cached) {
        setRepoStats(cached.repoStats)
        setTotals(cached.totals)
        setFromCache(true)
        setLastRefreshAt(cached.fetchedAt)
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
        const partialTotals: GrandTotals = {
          repos: results.length,
          commits: results.reduce((s, r) => s + r.commits, 0),
          additions: results.reduce((s, r) => s + r.additions, 0),
          deletions: results.reduce((s, r) => s + r.deletions, 0),
          net: results.reduce((s, r) => s + r.additions - r.deletions, 0),
        }
        setTotals(partialTotals)
        setProgress(null)
        setState('done')
        return
      }

      const grandTotals: GrandTotals = {
        repos: results.length,
        commits: results.reduce((s, r) => s + r.commits, 0),
        additions: results.reduce((s, r) => s + r.additions, 0),
        deletions: results.reduce((s, r) => s + r.deletions, 0),
        net: results.reduce((s, r) => s + r.additions - r.deletions, 0),
      }

      setRepoStats([...results].sort((a, b) => b.commits - a.commits))
      setTotals(grandTotals)
      setProgress(null)
      setLastRefreshAt(Date.now())

      saveCache({
        username: username.trim(),
        fetchedAt: Date.now(),
        repoStats: results,
        orgStats: [],
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
          orgStats: [],
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
          batch.map((r) =>
            getRepoCommits(r.repo, username.trim(), token || undefined, {
              maxCommits: 100,
              exclusions: filters.exclusions,
            }),
          ),
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

      // Fetch extended data in background: profile, PRs, issues,
      // contribution types, repo metadata. All non-fatal.
      if (!cancelRef.current) {
        setFetchingExtra(true)
        const u = username.trim()
        const t = token || undefined
        Promise.allSettled([
          getUserProfile(u, t).then(setProfile),
          getContributionTypes(u, t, 3).then(setContribTypes),
          getUserPRs(u, t, 100).then(setPRs),
          getUserIssues(u, t, 100).then(setIssues),
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
  }, [username, token, filters])

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
            {lastRefreshAt && (
              <span className="text-[10px] text-zinc-400 tabular-nums" title={new Date(lastRefreshAt).toLocaleString()}>
                Refreshed {formatLastRefresh(lastRefreshAt)}
              </span>
            )}
            {rateLimit && (
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  rateLimit.remaining < rateLimit.limit * 0.2 ? 'text-amber-400' : 'text-zinc-400'
                }`}
                title={`GitHub API requests remaining: ${rateLimit.remaining.toLocaleString()} of ${rateLimit.limit.toLocaleString()}. Resets in ${timeUntilReset(rateLimit.reset)}.`}
              >
                API {rateLimit.remaining.toLocaleString()} / {rateLimit.limit.toLocaleString()} left
                {rateLimit.remaining < rateLimit.limit && ` · resets ${timeUntilReset(rateLimit.reset)}`}
              </span>
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

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TimePeriodSelector filters={filters} onChange={setFilters} />
              <ExclusionEditor filters={filters} onChange={setFilters} />
            </div>

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
            </div>

            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-6" role="tabpanel" id="tab-panel" aria-labelledby="tab-overview">
                {profile && <ProfileCard profile={profile} />}

                {/* Inline figures — not cards */}
                <div className="flex flex-wrap gap-x-8 gap-y-3 py-2">
                  <Figure label="Repos" value={filteredTotals.repos} />
                  <Figure label="Commits" value={filteredTotals.commits} />
                  <Figure label="Added" value={filteredTotals.additions} color="text-emerald-400" />
                  <Figure label="Deleted" value={filteredTotals.deletions} color="text-rose-400" />
                  <Figure
                    label="Net"
                    value={filteredTotals.net}
                    color={filteredTotals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                    signed
                  />
                </div>

                {contribTypes && <ContributionTypeChart types={contribTypes} />}

                {/* Per-org table */}
                {filteredOrgStats.length > 0 && (
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
                          {filteredOrgStats.map((o) => (
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


          </div>
        )}

        {/* Empty state — teaches the interface */}
        {state === 'idle' && (
          <section className="grid gap-10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(20rem,.9fr)] md:items-center md:py-16" aria-labelledby="gitstat-intro">
            <div>
              <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-400">
                Live dashboard · public repositories
              </p>
              <h2 id="gitstat-intro" className="max-w-xl text-3xl font-semibold tracking-[-0.035em] text-zinc-50 sm:text-5xl">
                See the shape of a GitHub footprint, not just a contribution count.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base">
                Enter any GitHub username above. GitStat aggregates activity across repositories
                and organizations, then separates output, churn, pull requests, issues, patterns,
                and sampled AI-agent involvement.
              </p>
              <div className="mt-8 space-y-3">
                <Step n="1" text="No login required for public repositories" />
                <Step n="2" text="Time windows and generated-file exclusions stay adjustable" />
                <Step n="3" text="Every result remains linked back to the underlying repositories" />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70 shadow-2xl shadow-black/30" aria-label="Illustrative GitStat dashboard output">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 font-mono text-[10px] text-zinc-500">
                <span>Illustrative output</span>
                <span className="text-emerald-400">● ready</span>
              </div>
              <div className="grid grid-cols-2 border-b border-zinc-800 sm:grid-cols-4">
                {[
                  ['Repos', '42'],
                  ['Commits', '1.8K'],
                  ['Added', '+284K'],
                  ['Deleted', '-91K'],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-zinc-800 p-4 even:border-l sm:border-b-0 sm:border-l sm:first:border-l-0">
                    <p className="text-[10px] text-zinc-500">{label}</p>
                    <p className="mt-1 font-mono text-sm text-zinc-200">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Monthly activity</span>
                  <span>12 months</span>
                </div>
                <div className="flex h-28 items-end gap-2" aria-hidden="true">
                  {[28, 42, 34, 58, 49, 70, 62, 86, 67, 92, 78, 100].map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className="flex-1 rounded-t-sm bg-blue-500/70"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <p className="text-[10px] leading-5 text-zinc-500">
                  The dashboard uses live GitHub data after you submit a username. This preview is
                  illustrative and does not represent a real account.
                </p>
              </div>
            </div>
          </section>
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
          const tabs = ['tab-overview', 'tab-activity', 'tab-churn', 'tab-ai', 'tab-patterns', 'tab-prs', 'tab-issues', 'tab-repos']
          const idx = tabs.indexOf(id)
          const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length
          const el = document.getElementById(tabs[next])
          el?.click()
          el?.focus()
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
