export interface WeekData {
  w: number      // week start timestamp (seconds)
  a: number      // additions
  d: number      // deletions
  c: number      // commits
}

export interface RepoStats {
  repo: string
  commits: number
  additions: number
  deletions: number
  weeks: WeekData[]
  languages?: Record<string, number>
}

export interface OrgStats {
  org: string
  repos: number
  commits: number
  additions: number
  deletions: number
  net: number
}

export interface GrandTotals {
  repos: number
  commits: number
  additions: number
  deletions: number
  net: number
}

export interface FetchProgress {
  total: number
  processed: number
  skipped: number
  current: string
}

export interface CachedResults {
  username: string
  fetchedAt: number
  repoStats: RepoStats[]
  orgStats: OrgStats[]
  totals: GrandTotals
}

export interface RateLimitInfo {
  remaining: number
  limit: number
  reset: number
}

export interface MonthlyData {
  month: string     // "2024-01"
  label: string     // "Jan 2024"
  commits: number
  additions: number
  deletions: number
}

export interface DayData {
  date: string      // "2024-01-15"
  commits: number
  additions: number
  deletions: number
}

/** Real daily contribution count from GraphQL contribution calendar. */
export interface ContributionDay {
  date: string         // "2024-01-15"
  count: number        // contribution count (commits, PRs, issues, reviews)
}

export interface SummaryStats {
  peakMonth: MonthlyData | null
  longestStreak: number       // consecutive days with commits
  currentStreak: number
  avgCommitsPerWeek: number
  mostActiveDay: DayData | null
  totalActiveDays: number
  firstCommitDate: string | null
  lastCommitDate: string | null
}

export interface LanguageStat {
  language: string
  bytes: number
  percentage: number
}

// --- Commit data for AI detection ---

export interface CommitInfo {
  repo: string
  sha: string
  message: string
  date: string         // ISO date
  authorLogin: string | null
  authorName: string
  authorEmail: string
  additions?: number
  deletions?: number
  excludedAdditions?: number
  excludedDeletions?: number
}

export type AITool = 'Devin' | 'Claude' | 'GitHub Copilot' | 'Cursor' | 'ChatGPT' | 'Gemini' | 'Codeium' | 'Windsurf' | 'Aider' | 'Codex' | 'Unknown Bot'

export interface AIDetection {
  tool: AITool
  pattern: string
}

export interface CommitAISignal {
  commit: CommitInfo
  detected: AIDetection[]
}

export interface AIInvolvementStats {
  totalCommitsScanned: number
  aiAssistedCommits: number
  aiAssistedPercentage: number
  byTool: Record<string, number>
  monthlyTimeline: { month: string; label: string; total: number; aiAssisted: number }[]
  recentAICommits: CommitAISignal[]
  botCommits: number
  botPercentage: number
}

// --- Churn analytics ---

export interface ChurnMonthlyData {
  month: string
  label: string
  grossChurn: number       // additions + deletions
  netChurn: number         // additions - deletions
  churnPerCommit: number   // grossChurn / commits
  commits: number
}

export interface ChurnStats {
  monthly: ChurnMonthlyData[]
  avgChurnPerCommit: number
  churnVolatility: number       // stddev of weekly churn
  peakChurnMonth: ChurnMonthlyData | null
  topChurnRepos: { repo: string; churn: number; commits: number }[]
  recentTrend: 'increasing' | 'decreasing' | 'stable'
}

// --- Commit patterns ---

export interface CommitPatterns {
  focusConcentration: {
    topRepo: string
    topRepoShare: number       // percentage
    top5Share: number          // top 5 repos share
    top10Share: number
    giniCoefficient: number    // 0 = evenly distributed, 1 = all in one repo
  }
  commitSizeDistribution: {
    small: number              // <10 lines changed per commit (approx)
    medium: number             // 10-100
    large: number              // 100-500
    veryLarge: number          // 500+
  }
  repoActivity: {
    active: number             // commits in last 30 days
    recent: number             // commits in last 90 days
    stale: number              // commits in last year
    dormant: number            // no commits in over a year
  }
  cadence: {
    avgCommitsPerActiveWeek: number
    medianWeeklyCommits: number
    maxWeeklyCommits: number
    burstWeeks: number         // weeks with >2x average
  }
  commitQuality: {
    avgMsgLen: number          // average first-line length
    meaningfulRatio: number    // 0-1, fraction of non-trivial messages
    sampled: number            // total messages analyzed
    trivialCount: number
    meaningfulCount: number
  }
}

// --- Profile data ---

export interface UserProfile {
  login: string
  name: string | null
  bio: string | null
  company: string | null
  location: string | null
  avatarUrl: string
  followers: number
  following: number
  createdAt: string
  publicRepos: number
  hireable: boolean
  blog: string | null
}

// --- Enhanced repo metadata ---

export interface RepoMetadata {
  fullName: string
  stars: number
  forks: number
  openIssues: number
  primaryLanguage: string | null
  topics: string[]
  license: string | null
  isFork: boolean
  isArchived: boolean
  createdAt: string
  pushedAt: string
  description: string | null
}

// --- Contribution type breakdown ---

export interface ContributionTypes {
  commits: number
  pullRequests: number
  issues: number
  pullRequestReviews: number
  repositories: number
}

// --- PR data ---

export interface PRInfo {
  repo: string
  number: number
  title: string
  state: 'open' | 'merged' | 'closed'
  createdAt: string
  mergedAt: string | null
  closedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
}

export interface PRStats {
  total: number
  open: number
  merged: number
  closed: number
  mergeRate: number
  avgMergeTimeHours: number
  medianMergeTimeHours: number
  avgPRSize: number
  sizeDistribution: { small: number; medium: number; large: number; veryLarge: number }
  monthlyTimeline: { month: string; label: string; opened: number; merged: number }[]
  recentPRs: PRInfo[]
  topRepos: { repo: string; count: number; merged: number }[]
}

// --- Issue data ---

export interface IssueInfo {
  repo: string
  number: number
  title: string
  state: 'open' | 'closed'
  createdAt: string
  closedAt: string | null
  labels: string[]
}

export interface IssueStats {
  total: number
  open: number
  closed: number
  closeRate: number
  avgResolutionTimeHours: number
  medianResolutionTimeHours: number
  topLabels: { label: string; count: number }[]
  monthlyTimeline: { month: string; label: string; opened: number; closed: number }[]
  recentIssues: IssueInfo[]
  topRepos: { repo: string; count: number; closed: number }[]
}

// --- Starred repos ---

export interface StarredRepo {
  fullName: string
  language: string | null
  stars: number
  description: string | null
}

export interface StarredStats {
  total: number
  languageDistribution: { language: string; count: number; percentage: number }[]
  topStarred: StarredRepo[]
}

// --- Time patterns ---

export interface TimePatterns {
  hourOfDay: number[]    // 24 elements, commit counts per hour
  dayOfWeek: number[]    // 7 elements, commit counts per day
  peakHour: number
  peakDay: number
  nightOwlScore: number       // 0-100, higher = more night commits
  weekendWarriorScore: number // 0-100, higher = more weekend commits
  morningCommits: number      // 6-12
  afternoonCommits: number    // 12-18
  eveningCommits: number      // 18-24
  nightCommits: number        // 0-6
  weekdayCommits: number
  weekendCommits: number
}

// --- Conventional commit breakdown ---

export interface ConventionalCommitBreakdown {
  feat: number
  fix: number
  chore: number
  docs: number
  test: number
  refactor: number
  perf: number
  style: number
  ci: number
  build: number
  revert: number
  nonConventional: number
  total: number
}

// --- Collaboration ---

export interface CollaborationStats {
  totalCoAuthored: number
  soloCommits: number
  pairRatio: number
  topCollaborators: { name: string; count: number; repos: number }[]
}

// --- Commit keywords ---

export interface KeywordStats {
  topKeywords: { word: string; count: number }[]
}

// --- Gap analysis ---

export interface GapAnalysis {
  longestGap: { startDate: string; endDate: string; days: number } | null
  topGaps: { startDate: string; endDate: string; days: number }[]
  totalInactiveDays: number
  avgGapDays: number
}

// --- Punch card ---

export interface PunchCardData {
  day: number    // 0-6 (Sun-Sat)
  hour: number   // 0-23
  commits: number
}

// --- Activity events ---

export interface ActivityEvent {
  type: string
  repo: string
  createdAt: string
  summary: string
}

// --- Repo metadata analytics ---

export interface RepoMetadataStats {
  totalRepos: number
  totalStars: number
  totalForks: number
  avgStarsPerRepo: number
  topStarredRepos: { repo: string; stars: number; forks: number; language: string | null }[]
  forkRatio: number
  archivedCount: number
  topTopics: { topic: string; count: number }[]
  licenseDistribution: { license: string; count: number }[]
}
