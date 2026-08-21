import type { RepoStats, CommitInfo, ContributionDay, PRInfo, IssueInfo } from '../types'

export type TimePeriod = '7d' | '30d' | '1y' | 'all'

export interface FilterSettings {
  period: TimePeriod
  exclusions: string[]
}

const PERIOD_DAYS: Record<TimePeriod, number | null> = {
  '7d': 7,
  '30d': 30,
  '1y': 365,
  all: null,
}

const EXCLUSION_PRESETS = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'Podfile.lock',
  'Gemfile.lock',
  'composer.lock',
  '*.min.js',
  '*.min.css',
  'dist/**',
]

export function getPeriodStartDate(period: TimePeriod): Date | null {
  const days = PERIOD_DAYS[period]
  if (days == null) return null
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isDateInPeriod(dateStr: string, period: TimePeriod): boolean {
  const start = getPeriodStartDate(period)
  if (!start) return true
  return new Date(dateStr).getTime() >= start.getTime()
}

export function isTimestampInPeriod(tsSeconds: number, period: TimePeriod): boolean {
  const start = getPeriodStartDate(period)
  if (!start) return true
  return tsSeconds * 1000 >= start.getTime()
}

export function loadFilters(): FilterSettings {
  try {
    const raw = localStorage.getItem('gitstat_filters')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.period === 'string') {
        return {
          period: ['7d', '30d', '1y', 'all'].includes(parsed.period) ? parsed.period : 'all',
          exclusions: Array.isArray(parsed.exclusions) ? parsed.exclusions : [],
        }
      }
    }
  } catch {
    // ignore
  }
  return { period: 'all', exclusions: [] }
}

export function saveFilters(filters: FilterSettings) {
  try {
    localStorage.setItem('gitstat_filters', JSON.stringify(filters))
  } catch {
    // ignore
  }
}

export function getExclusionPresets(): string[] {
  return EXCLUSION_PRESETS
}

export function matchesExclusion(filename: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  const lower = filename.toLowerCase()
  for (const pattern of patterns) {
    const p = pattern.trim().toLowerCase()
    if (!p) continue
    if (p.includes('*') || p.includes('?')) {
      const regex = new RegExp(
        '^' +
          p
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/\{\{GLOBSTAR\}\}/g, '.*') +
          '$',
      )
      if (regex.test(lower)) return true
    } else if (lower === p || lower.endsWith('/' + p)) {
      return true
    }
  }
  return false
}

export function filterRepoStatsByPeriod(repoStats: RepoStats[], period: TimePeriod): RepoStats[] {
  const start = getPeriodStartDate(period)
  if (!start) return repoStats
  const startMs = start.getTime()
  return repoStats
    .map((repo) => {
      const weeks = repo.weeks.filter((w) => w.w * 1000 >= startMs)
      if (weeks.length === 0) {
        return { ...repo, weeks, commits: 0, additions: 0, deletions: 0 }
      }
      return {
        ...repo,
        weeks,
        commits: weeks.reduce((s, w) => s + w.c, 0),
        additions: weeks.reduce((s, w) => s + w.a, 0),
        deletions: weeks.reduce((s, w) => s + w.d, 0),
      }
    })
    .filter((repo) => repo.commits > 0 || repo.additions > 0 || repo.deletions > 0)
}

export function filterCommitsByPeriod(commits: CommitInfo[], period: TimePeriod): CommitInfo[] {
  if (period === 'all') return commits
  const start = getPeriodStartDate(period)!
  return commits.filter((c) => c.date && new Date(c.date).getTime() >= start.getTime())
}

export function filterPRsByPeriod(prs: PRInfo[], period: TimePeriod): PRInfo[] {
  if (period === 'all') return prs
  const start = getPeriodStartDate(period)!
  return prs.filter((p) => new Date(p.createdAt).getTime() >= start.getTime())
}

export function filterIssuesByPeriod(issues: IssueInfo[], period: TimePeriod): IssueInfo[] {
  if (period === 'all') return issues
  const start = getPeriodStartDate(period)!
  return issues.filter((i) => new Date(i.createdAt).getTime() >= start.getTime())
}

export function filterContributionDays(days: ContributionDay[], period: TimePeriod): ContributionDay[] {
  if (period === 'all') return days
  const start = getPeriodStartDate(period)!
  return days.filter((d) => new Date(d.date).getTime() >= start.getTime())
}

/**
 * Apply line-type exclusion ratios derived from sampled commits to aggregate repo stats.
 * We only have per-file diff data for the commits we sampled, so we use the sample's
 * excluded ratio as an estimate for the repo's aggregate additions/deletions.
 */
export function applyExclusionsToRepoStats(repoStats: RepoStats[], commits: CommitInfo[]): RepoStats[] {
  const withExclusions = commits.filter((c) =>
    (c.excludedAdditions ?? 0) > 0 || (c.excludedDeletions ?? 0) > 0,
  )
  if (withExclusions.length === 0) return repoStats

  const byRepo = new Map<string, CommitInfo[]>()
  for (const c of withExclusions) {
    if (!byRepo.has(c.repo)) byRepo.set(c.repo, [])
    byRepo.get(c.repo)!.push(c)
  }

  return repoStats.map((repo) => {
    const repoCommits = byRepo.get(repo.repo)
    if (!repoCommits || repoCommits.length === 0) return repo

    const sampleAdditions = repoCommits.reduce((s, c) => s + (c.additions || 0), 0)
    const sampleDeletions = repoCommits.reduce((s, c) => s + (c.deletions || 0), 0)
    const excludedAdditions = repoCommits.reduce((s, c) => s + (c.excludedAdditions || 0), 0)
    const excludedDeletions = repoCommits.reduce((s, c) => s + (c.excludedDeletions || 0), 0)

    const addMultiplier = sampleAdditions > 0 ? Math.max(0, 1 - excludedAdditions / sampleAdditions) : 1
    const delMultiplier = sampleDeletions > 0 ? Math.max(0, 1 - excludedDeletions / sampleDeletions) : 1

    return {
      ...repo,
      additions: Math.round(repo.additions * addMultiplier),
      deletions: Math.round(repo.deletions * delMultiplier),
      weeks: repo.weeks.map((w) => ({
        ...w,
        a: Math.round(w.a * addMultiplier),
        d: Math.round(w.d * delMultiplier),
      })),
    }
  })
}
