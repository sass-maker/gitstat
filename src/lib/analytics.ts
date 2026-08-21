import type { RepoStats, MonthlyData, DayData, SummaryStats, LanguageStat, CommitInfo, AIDetection, AITool, CommitAISignal, AIInvolvementStats, ChurnStats, ChurnMonthlyData, CommitPatterns, ContributionDay, TimePatterns, ConventionalCommitBreakdown, CollaborationStats, KeywordStats, GapAnalysis, PRInfo, PRStats, IssueInfo, IssueStats, StarredRepo, StarredStats, RepoMetadata, RepoMetadataStats } from '../types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function weekStartToDate(w: number): Date {
  return new Date(w * 1000)
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

/**
 * Aggregate all weekly data from all repos into monthly buckets.
 */
export function computeMonthlyData(repoStats: RepoStats[]): MonthlyData[] {
  const monthMap: Record<string, MonthlyData> = {}

  for (const repo of repoStats) {
    for (const week of repo.weeks) {
      if (week.c === 0 && week.a === 0 && week.d === 0) continue
      const date = weekStartToDate(week.w)
      const key = monthKey(date)
      if (!monthMap[key]) {
        monthMap[key] = { month: key, label: monthLabel(key), commits: 0, additions: 0, deletions: 0 }
      }
      monthMap[key].commits += week.c
      monthMap[key].additions += week.a
      monthMap[key].deletions += week.d
    }
  }

  return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * Build daily activity map from REAL GraphQL contribution calendar data.
 * This gives actual daily commit counts (not the weekly approximation).
 * Additions/deletions are not available from the contribution calendar,
 * so they remain 0 — the heatmap uses commit count for intensity.
 */
export function computeDailyDataFromCalendar(contributionDays: ContributionDay[]): Map<string, DayData> {
  const dayMap = new Map<string, DayData>()
  for (const d of contributionDays) {
    dayMap.set(d.date, { date: d.date, commits: d.count, additions: 0, deletions: 0 })
  }
  return dayMap
}

/**
 * Distribute weekly commits across the 7 days of each week (evenly split)
 * to build a daily activity map for the heatmap.
 * Used as a fallback when GraphQL contribution calendar data is not available.
 * GitHub's stats API only gives weekly granularity, so we approximate.
 */
export function computeDailyData(repoStats: RepoStats[]): Map<string, DayData> {
  const dayMap = new Map<string, DayData>()

  for (const repo of repoStats) {
    for (const week of repo.weeks) {
      if (week.c === 0) continue
      const start = weekStartToDate(week.w)
      // Distribute commits across the 7 days evenly
      const perDay = week.c / 7
      const addPerDay = week.a / 7
      const delPerDay = week.d / 7
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        const key = dateKey(d)
        if (!dayMap.has(key)) {
          dayMap.set(key, { date: key, commits: 0, additions: 0, deletions: 0 })
        }
        const entry = dayMap.get(key)!
        entry.commits += perDay
        entry.additions += addPerDay
        entry.deletions += delPerDay
      }
    }
  }

  return dayMap
}

/**
 * Compute summary stats: peak month, streaks, averages, etc.
 */
export function computeSummaryStats(repoStats: RepoStats[], monthlyData: MonthlyData[], dailyData: Map<string, DayData>): SummaryStats {
  // Peak month
  const peakMonth = monthlyData.reduce<MonthlyData | null>(
    (best, m) => (!best || m.commits > best.commits) ? m : best,
    null,
  )

  // Sort daily data by date
  const sortedDays = [...dailyData.entries()]
    .filter(([, d]) => d.commits > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))

  // Longest streak (consecutive days with commits)
  let longestStreak = 0
  let currentStreak = 0
  let prevDate: Date | null = null

  for (const [dateStr] of sortedDays) {
    const d = new Date(dateStr)
    if (prevDate) {
      const diff = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diff === 1) {
        currentStreak++
      } else {
        currentStreak = 1
      }
    } else {
      currentStreak = 1
    }
    longestStreak = Math.max(longestStreak, currentStreak)
    prevDate = d
  }

  // Current streak (from the most recent active day backwards)
  let currentStreakCount = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = dateKey(d)
    if (dailyData.has(key) && dailyData.get(key)!.commits > 0) {
      currentStreakCount++
    } else if (i > 0) {
      break
    }
  }

  // Most active day
  const mostActiveDay = sortedDays.reduce<DayData | null>(
    (best, [, d]) => (!best || d.commits > best.commits) ? d : best,
    null,
  )

  // Average commits per week
  const totalWeeks = repoStats.reduce((max, r) => {
    if (r.weeks.length === 0) return max
    return Math.max(max, r.weeks[r.weeks.length - 1].w - r.weeks[0].w)
  }, 0)
  const weekCount = totalWeeks > 0 ? totalWeeks / (7 * 24 * 60 * 60) : 1
  const totalCommits = repoStats.reduce((s, r) => s + r.commits, 0)
  const avgCommitsPerWeek = weekCount > 0 ? totalCommits / weekCount : 0

  // First and last commit dates
  const firstCommitDate = sortedDays.length > 0 ? sortedDays[0][0] : null
  const lastCommitDate = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1][0] : null

  return {
    peakMonth,
    longestStreak: Math.round(longestStreak),
    currentStreak: currentStreakCount,
    avgCommitsPerWeek: Math.round(avgCommitsPerWeek * 10) / 10,
    mostActiveDay,
    totalActiveDays: sortedDays.length,
    firstCommitDate,
    lastCommitDate,
  }
}

/**
 * Aggregate language data across all repos.
 */
export function computeLanguageStats(repoStats: RepoStats[]): LanguageStat[] {
  const langMap: Record<string, number> = {}

  for (const repo of repoStats) {
    if (!repo.languages) continue
    for (const [lang, bytes] of Object.entries(repo.languages)) {
      langMap[lang] = (langMap[lang] || 0) + bytes
    }
  }

  const total = Object.values(langMap).reduce((s, v) => s + v, 0)
  if (total === 0) return []

  return Object.entries(langMap)
    .map(([language, bytes]) => ({
      language,
      bytes,
      percentage: (bytes / total) * 100,
    }))
    .sort((a, b) => b.bytes - a.bytes)
}

/**
 * Get the last N months of data, filling gaps with zeros.
 */
export function getRecentMonths(monthlyData: MonthlyData[], n: number): MonthlyData[] {
  if (monthlyData.length === 0) return []
  const last = monthlyData[monthlyData.length - 1].month
  const [lastY, lastM] = last.split('-').map(Number)
  const result: MonthlyData[] = []

  for (let i = n - 1; i >= 0; i--) {
    let y = lastY
    let m = lastM - i
    while (m <= 0) { m += 12; y-- }
    const key = `${y}-${String(m).padStart(2, '0')}`
    const existing = monthlyData.find((d) => d.month === key)
    result.push(existing || { month: key, label: monthLabel(key), commits: 0, additions: 0, deletions: 0 })
  }

  return result
}

// =====================
// AI AGENT DETECTION
// =====================

const AI_PATTERNS: { tool: AITool; patterns: RegExp[] }[] = [
  {
    tool: 'Devin',
    patterns: [
      /Generated with \[?Devin\]?/i,
      /Co-Authored-By:.*devin-ai-integration/i,
      /Co-Authored-By:.*Devin\b/i,
    ],
  },
  {
    tool: 'Claude',
    patterns: [
      /Generated with \[?Claude\]?/i,
      /Co-Authored-By:.*Claude\b/i,
      /\bAnthropic\b.*generated/i,
      /🤖.*claude/i,
    ],
  },
  {
    tool: 'GitHub Copilot',
    patterns: [
      /Co-Authored-By:.*Copilot\b/i,
      /Generated with.*Copilot/i,
      /\bGitHub Copilot\b/i,
    ],
  },
  {
    tool: 'Cursor',
    patterns: [
      /Co-Authored-By:.*Cursor\b/i,
      /Generated with.*Cursor/i,
      /\bCursor AI\b/i,
    ],
  },
  {
    tool: 'ChatGPT',
    patterns: [
      /Co-Authored-By:.*ChatGPT\b/i,
      /Generated with.*ChatGPT/i,
      /\bOpenAI\b.*generated/i,
    ],
  },
  {
    tool: 'Gemini',
    patterns: [
      /Co-Authored-By:.*Gemini\b/i,
      /Generated with.*Gemini/i,
      /\bGoogle AI\b.*generated/i,
    ],
  },
  {
    tool: 'Codeium',
    patterns: [
      /Co-Authored-By:.*Codeium\b/i,
      /Generated with.*Codeium/i,
    ],
  },
  {
    tool: 'Windsurf',
    patterns: [
      /Co-Authored-By:.*Windsurf\b/i,
      /Generated with.*Windsurf/i,
    ],
  },
  {
    tool: 'Aider',
    patterns: [
      /Co-Authored-By:.*aider\b/i,
      /Generated with.*aider/i,
      /\baider\b.*generated/i,
    ],
  },
  {
    tool: 'Codex',
    patterns: [
      /Co-Authored-By:.*Codex\b/i,
      /Generated with.*Codex/i,
      /\bOpenAI Codex\b/i,
    ],
  },
]

const BOT_PATTERNS: RegExp[] = [
  /Co-Authored-By:.*\[bot\]/i,
  /Co-Authored-By:.*-bot@/i,
  /Co-Authored-By:.*dependabot/i,
  /Co-Authored-By:.*renovate/i,
  /Co-Authored-By:.*greenkeeper/i,
  /Co-Authored-By:.*allcontributors/i,
  /Co-Authored-By:.*github-actions/i,
  /Co-Authored-By:.*semantic-release/i,
]

const KNOWN_BOT_LOGINS = [
  'dependabot', 'dependabot-preview', 'renovate', 'renovate-bot',
  'greenkeeper', 'greenkeeperio-bot', 'allcontributors', 'github-actions',
  'semantic-release-bot', 'mergify', 'netlify', 'vercel', 'imgbot',
  'stale', 'lock', 'desensitized-bot',
]

function detectAIInCommit(commit: CommitInfo): { detected: AIDetection[]; isBot: boolean } {
  const detected: AIDetection[] = []
  const msg = commit.message

  for (const { tool, patterns } of AI_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(msg)) {
        detected.push({ tool, pattern: pattern.source })
        break
      }
    }
  }

  // Check for bot co-authors
  let isBot = false
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(msg)) {
      isBot = true
      if (detected.length === 0) {
        detected.push({ tool: 'Unknown Bot', pattern: pattern.source })
      }
      break
    }
  }

  // Check if author is a known bot
  if (commit.authorLogin) {
    const loginLower = commit.authorLogin.toLowerCase()
    for (const botLogin of KNOWN_BOT_LOGINS) {
      if (loginLower.includes(botLogin) || loginLower.endsWith('[bot]') || loginLower.endsWith('-bot')) {
        isBot = true
        if (detected.length === 0) {
          detected.push({ tool: 'Unknown Bot', pattern: `author:${commit.authorLogin}` })
        }
        break
      }
    }
  }

  return { detected, isBot }
}

export function computeAIInvolvement(commits: CommitInfo[]): AIInvolvementStats {
  const signals: CommitAISignal[] = []
  let botCommits = 0
  const byTool: Record<string, number> = {}
  const monthlyMap: Record<string, { month: string; label: string; total: number; aiAssisted: number }> = {}

  for (const commit of commits) {
    const { detected, isBot } = detectAIInCommit(commit)

    // Monthly timeline
    if (commit.date) {
      const d = new Date(commit.date)
      const key = monthKey(d)
      if (!monthlyMap[key]) {
        monthlyMap[key] = { month: key, label: monthLabel(key), total: 0, aiAssisted: 0 }
      }
      monthlyMap[key].total++
      if (detected.length > 0) monthlyMap[key].aiAssisted++
    }

    if (detected.length > 0) {
      signals.push({ commit, detected })
      for (const d of detected) {
        byTool[d.tool] = (byTool[d.tool] || 0) + 1
      }
    }

    if (isBot) botCommits++
  }

  const aiAssistedCommits = signals.length
  const totalCommitsScanned = commits.length
  const monthlyTimeline = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalCommitsScanned,
    aiAssistedCommits,
    aiAssistedPercentage: totalCommitsScanned > 0 ? (aiAssistedCommits / totalCommitsScanned) * 100 : 0,
    byTool,
    monthlyTimeline,
    recentAICommits: signals.slice(-20).reverse(),
    botCommits,
    botPercentage: totalCommitsScanned > 0 ? (botCommits / totalCommitsScanned) * 100 : 0,
  }
}

// =====================
// CHURN ANALYTICS
// =====================

export function computeChurnStats(repoStats: RepoStats[]): ChurnStats {
  // Monthly churn from weekly data
  const monthMap: Record<string, ChurnMonthlyData> = {}

  for (const repo of repoStats) {
    for (const week of repo.weeks) {
      if (week.c === 0 && week.a === 0 && week.d === 0) continue
      const date = weekStartToDate(week.w)
      const key = monthKey(date)
      if (!monthMap[key]) {
        monthMap[key] = {
          month: key,
          label: monthLabel(key),
          grossChurn: 0,
          netChurn: 0,
          churnPerCommit: 0,
          commits: 0,
        }
      }
      monthMap[key].grossChurn += week.a + week.d
      monthMap[key].netChurn += week.a - week.d
      monthMap[key].commits += week.c
    }
  }

  const monthly = Object.values(monthMap)
    .map((m) => ({
      ...m,
      churnPerCommit: m.commits > 0 ? Math.round(m.grossChurn / m.commits) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Average churn per commit
  const totalChurn = monthly.reduce((s, m) => s + m.grossChurn, 0)
  const totalCommits = monthly.reduce((s, m) => s + m.commits, 0)
  const avgChurnPerCommit = totalCommits > 0 ? Math.round(totalChurn / totalCommits) : 0

  // Weekly churn volatility (stddev)
  const allWeeklyChurn: number[] = []
  for (const repo of repoStats) {
    for (const week of repo.weeks) {
      const churn = week.a + week.d
      if (churn > 0) allWeeklyChurn.push(churn)
    }
  }
  const meanWeekly = allWeeklyChurn.reduce((s, v) => s + v, 0) / (allWeeklyChurn.length || 1)
  const variance = allWeeklyChurn.reduce((s, v) => s + (v - meanWeekly) ** 2, 0) / (allWeeklyChurn.length || 1)
  const churnVolatility = Math.sqrt(variance)

  // Peak churn month
  const peakChurnMonth = monthly.reduce<ChurnMonthlyData | null>(
    (best, m) => (!best || m.grossChurn > best.grossChurn) ? m : best,
    null,
  )

  // Top churn repos
  const repoChurn = repoStats
    .map((r) => ({
      repo: r.repo,
      churn: r.additions + r.deletions,
      commits: r.commits,
    }))
    .filter((r) => r.churn > 0)
    .sort((a, b) => b.churn - a.churn)
    .slice(0, 10)

  // Recent trend (compare last 3 months to previous 3 months)
  const recent = monthly.slice(-3)
  const previous = monthly.slice(-6, -3)
  const recentAvg = recent.reduce((s, m) => s + m.grossChurn, 0) / (recent.length || 1)
  const previousAvg = previous.reduce((s, m) => s + m.grossChurn, 0) / (previous.length || 1)
  let recentTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
  if (previousAvg > 0) {
    const ratio = recentAvg / previousAvg
    if (ratio > 1.15) recentTrend = 'increasing'
    else if (ratio < 0.85) recentTrend = 'decreasing'
  }

  return {
    monthly,
    avgChurnPerCommit,
    churnVolatility: Math.round(churnVolatility),
    peakChurnMonth,
    topChurnRepos: repoChurn,
    recentTrend,
  }
}

// =====================
// COMMIT PATTERNS
// =====================

export function computeCommitPatterns(
  repoStats: RepoStats[],
  commitQuality?: { avgMsgLen: number; meaningfulRatio: number; sampled: number; trivialCount: number; meaningfulCount: number },
): CommitPatterns {
  // Focus concentration
  const sortedByCommits = [...repoStats].sort((a, b) => b.commits - a.commits)
  const totalCommits = sortedByCommits.reduce((s, r) => s + r.commits, 0)
  const topRepo = sortedByCommits[0]
  const top5Commits = sortedByCommits.slice(0, 5).reduce((s, r) => s + r.commits, 0)
  const top10Commits = sortedByCommits.slice(0, 10).reduce((s, r) => s + r.commits, 0)

  // Gini coefficient for commit distribution
  const commits = sortedByCommits.map((r) => r.commits).filter((c) => c > 0)
  const n = commits.length
  let gini = 0
  if (n > 0 && totalCommits > 0) {
    const sortedCommits = [...commits].sort((a, b) => a - b)
    const sum = sortedCommits.reduce((s, c, i) => s + c * (i + 1), 0)
    gini = (2 * sum) / (n * totalCommits) - (n + 1) / n
  }

  // Commit size distribution (approximated from weekly churn per commit)
  let small = 0, medium = 0, large = 0, veryLarge = 0
  for (const repo of repoStats) {
    for (const week of repo.weeks) {
      if (week.c === 0) continue
      const churnPerCommit = (week.a + week.d) / week.c
      if (churnPerCommit < 10) small += week.c
      else if (churnPerCommit < 100) medium += week.c
      else if (churnPerCommit < 500) large += week.c
      else veryLarge += week.c
    }
  }

  // Repository activity (based on last commit week)
  const now = Date.now() / 1000
  const thirtyDaysAgo = now - 30 * 86400
  const ninetyDaysAgo = now - 90 * 86400
  const oneYearAgo = now - 365 * 86400
  let active = 0, recent = 0, stale = 0, dormant = 0

  for (const repo of repoStats) {
    if (repo.commits === 0) {
      dormant++
      continue
    }
    const lastWeek = repo.weeks[repo.weeks.length - 1]
    if (!lastWeek) {
      dormant++
      continue
    }
    if (lastWeek.w >= thirtyDaysAgo) active++
    else if (lastWeek.w >= ninetyDaysAgo) recent++
    else if (lastWeek.w >= oneYearAgo) stale++
    else dormant++
  }

  // Cadence
  const weeklyCommitCounts: number[] = []
  for (const repo of repoStats) {
    for (const week of repo.weeks) {
      if (week.c > 0) weeklyCommitCounts.push(week.c)
    }
  }
  weeklyCommitCounts.sort((a, b) => a - b)
  const totalWeeks = weeklyCommitCounts.length
  const sumCommits = weeklyCommitCounts.reduce((s, v) => s + v, 0)
  const avgWeekly = totalWeeks > 0 ? sumCommits / totalWeeks : 0
  const medianWeekly = totalWeeks > 0 ? weeklyCommitCounts[Math.floor(totalWeeks / 2)] : 0
  const maxWeekly = totalWeeks > 0 ? weeklyCommitCounts[totalWeeks - 1] : 0
  const burstWeeks = weeklyCommitCounts.filter((c) => c > avgWeekly * 2).length

  return {
    focusConcentration: {
      topRepo: topRepo?.repo || '—',
      topRepoShare: totalCommits > 0 && topRepo ? (topRepo.commits / totalCommits) * 100 : 0,
      top5Share: totalCommits > 0 ? (top5Commits / totalCommits) * 100 : 0,
      top10Share: totalCommits > 0 ? (top10Commits / totalCommits) * 100 : 0,
      giniCoefficient: Math.round(gini * 100) / 100,
    },
    commitSizeDistribution: { small, medium, large, veryLarge },
    repoActivity: { active, recent, stale, dormant },
    cadence: {
      avgCommitsPerActiveWeek: Math.round(avgWeekly * 10) / 10,
      medianWeeklyCommits: medianWeekly,
      maxWeeklyCommits: maxWeekly,
      burstWeeks,
    },
    commitQuality: commitQuality ?? {
      avgMsgLen: 0,
      meaningfulRatio: 0,
      sampled: 0,
      trivialCount: 0,
      meaningfulCount: 0,
    },
  }
}

// =====================
// TIME PATTERNS
// =====================

export function computeTimePatterns(commits: CommitInfo[]): TimePatterns {
  const hourOfDay = new Array(24).fill(0)
  const dayOfWeek = new Array(7).fill(0)
  let morning = 0, afternoon = 0, evening = 0, night = 0
  let weekday = 0, weekend = 0

  for (const c of commits) {
    if (!c.date) continue
    const d = new Date(c.date)
    const h = d.getUTCHours()
    const day = d.getUTCDay()

    hourOfDay[h]++
    dayOfWeek[day]++

    if (h >= 6 && h < 12) morning++
    else if (h >= 12 && h < 18) afternoon++
    else if (h >= 18 && h < 24) evening++
    else night++

    if (day === 0 || day === 6) weekend++
    else weekday++
  }

  const total = commits.length || 1
  const peakHour = hourOfDay.indexOf(Math.max(...hourOfDay))
  const peakDay = dayOfWeek.indexOf(Math.max(...dayOfWeek))
  const nightRatio = night / total
  const weekendRatio = weekend / total

  return {
    hourOfDay,
    dayOfWeek,
    peakHour,
    peakDay,
    nightOwlScore: Math.round(nightRatio * 100),
    weekendWarriorScore: Math.round(weekendRatio * 100),
    morningCommits: morning,
    afternoonCommits: afternoon,
    eveningCommits: evening,
    nightCommits: night,
    weekdayCommits: weekday,
    weekendCommits: weekend,
  }
}

// =====================
// CONVENTIONAL COMMIT BREAKDOWN
// =====================

const CONV_TYPES = ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'perf', 'style', 'ci', 'build', 'revert'] as const

export function computeConventionalBreakdown(commits: CommitInfo[]): ConventionalCommitBreakdown {
  const counts: Record<string, number> = {}
  for (const t of CONV_TYPES) counts[t] = 0
  let nonConv = 0

  for (const c of commits) {
    const firstLine = c.message.split('\n')[0].trim()
    const match = firstLine.match(/^(\w+)(?:\(.+?\))?[!:]/)
    if (match && counts[match[1].toLowerCase()] !== undefined) {
      counts[match[1].toLowerCase()]++
    } else {
      nonConv++
    }
  }

  return {
    ...counts,
    nonConventional: nonConv,
    total: commits.length,
  } as ConventionalCommitBreakdown
}

// =====================
// COLLABORATION
// =====================

export function computeCollaboration(commits: CommitInfo[]): CollaborationStats {
  const coAuthorCounts = new Map<string, { count: number; repos: Set<string> }>()
  let coAuthored = 0

  for (const c of commits) {
    const coAuthors = extractCoAuthors(c.message)
    if (coAuthors.length > 0) {
      coAuthored++
      for (const name of coAuthors) {
        const existing = coAuthorCounts.get(name)
        if (existing) {
          existing.count++
          existing.repos.add(c.repo)
        } else {
          coAuthorCounts.set(name, { count: 1, repos: new Set([c.repo]) })
        }
      }
    }
  }

  const topCollaborators = Array.from(coAuthorCounts.entries())
    .filter(([name]) => !name.toLowerCase().includes('bot') && !name.toLowerCase().includes('dependabot'))
    .map(([name, { count, repos }]) => ({ name, count, repos: repos.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const total = commits.length || 1
  return {
    totalCoAuthored: coAuthored,
    soloCommits: commits.length - coAuthored,
    pairRatio: coAuthored / total,
    topCollaborators,
  }
}

function extractCoAuthors(message: string): string[] {
  const coAuthors: string[] = []
  const lines = message.split('\n')
  for (const line of lines) {
    const m = line.match(/Co-Authored-By:\s*(.+)/i)
    if (m) {
      const name = m[1].trim().replace(/<.*>/, '').trim()
      if (name) coAuthors.push(name)
    }
  }
  return coAuthors
}

// =====================
// COMMIT KEYWORDS
// =====================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'to', 'in', 'on', 'at', 'for', 'of', 'with', 'and', 'or', 'but',
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'from',
  'by', 'as', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'any', 'both', 'each', 'add', 'added', 'fix',
  'fixed', 'update', 'updated', 'remove', 'removed', 'change', 'changed', 'merge',
  'branch', 'main', 'master', 'commit', 'push', 'pull', 'feat', 'chore', 'docs',
  'refactor', 'test', 'perf', 'style', 'ci', 'build', 'revert', 'init', 'wip',
  'tmp', 'temp', 'stuff', 'things', 'minor', 'typo', 'v1', 'v2', 'v3',
])

export function computeKeywordStats(commits: CommitInfo[]): KeywordStats {
  const wordCounts = new Map<string, number>()

  for (const c of commits) {
    const firstLine = c.message.split('\n')[0].trim().toLowerCase()
    // Remove conventional commit prefix and scope
    const cleaned = firstLine.replace(/^\w+(\(.+?\))?[!:]\s*/, '')
    const words = cleaned.split(/[\s\/\-_.,;:!?()\[\]{}'"`*#]+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    for (const w of words) {
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1)
    }
  }

  const topKeywords = Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .filter(k => k.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  return { topKeywords }
}

// =====================
// GAP ANALYSIS
// =====================

export function computeGapAnalysis(dailyData: Map<string, DayData>): GapAnalysis {
  const activeDates = Array.from(dailyData.keys())
    .filter(d => dailyData.get(d)!.commits > 0)
    .sort()

  if (activeDates.length < 2) {
    return { longestGap: null, topGaps: [], totalInactiveDays: 0, avgGapDays: 0 }
  }

  const gaps: { startDate: string; endDate: string; days: number }[] = []
  for (let i = 1; i < activeDates.length; i++) {
    const prev = new Date(activeDates[i - 1])
    const curr = new Date(activeDates[i])
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 1) {
      gaps.push({
        startDate: activeDates[i - 1],
        endDate: activeDates[i],
        days: diffDays - 1,
      })
    }
  }

  gaps.sort((a, b) => b.days - a.days)
  const totalInactive = gaps.reduce((s, g) => s + g.days, 0)

  return {
    longestGap: gaps[0] ?? null,
    topGaps: gaps.slice(0, 5),
    totalInactiveDays: totalInactive,
    avgGapDays: gaps.length > 0 ? Math.round(totalInactive / gaps.length) : 0,
  }
}

// =====================
// PR STATS
// =====================

export function computePRStats(prs: PRInfo[]): PRStats {
  if (prs.length === 0) {
    return {
      total: 0, open: 0, merged: 0, closed: 0, mergeRate: 0,
      avgMergeTimeHours: 0, medianMergeTimeHours: 0, avgPRSize: 0,
      sizeDistribution: { small: 0, medium: 0, large: 0, veryLarge: 0 },
      monthlyTimeline: [], recentPRs: [], topRepos: [],
    }
  }

  const open = prs.filter(p => p.state === 'open').length
  const merged = prs.filter(p => p.state === 'merged').length
  const closed = prs.filter(p => p.state === 'closed').length

  const mergeTimes = prs
    .filter(p => p.state === 'merged' && p.mergedAt && p.createdAt)
    .map(p => (new Date(p.mergedAt!).getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60))
    .filter(h => h >= 0)
    .sort((a, b) => a - b)

  const avgMergeTime = mergeTimes.length > 0 ? mergeTimes.reduce((s, h) => s + h, 0) / mergeTimes.length : 0
  const medianMergeTime = mergeTimes.length > 0 ? mergeTimes[Math.floor(mergeTimes.length / 2)] : 0

  const sizes = prs.map(p => p.additions + p.deletions)
  const avgSize = sizes.length > 0 ? Math.round(sizes.reduce((s, n) => s + n, 0) / sizes.length) : 0
  const sizeDist = { small: 0, medium: 0, large: 0, veryLarge: 0 }
  for (const s of sizes) {
    if (s < 50) sizeDist.small++
    else if (s < 300) sizeDist.medium++
    else if (s < 1000) sizeDist.large++
    else sizeDist.veryLarge++
  }

  // Monthly timeline
  const monthMap = new Map<string, { opened: number; merged: number }>()
  for (const p of prs) {
    const m = p.createdAt.slice(0, 7)
    if (!monthMap.has(m)) monthMap.set(m, { opened: 0, merged: 0 })
    monthMap.get(m)!.opened++
    if (p.state === 'merged' && p.mergedAt) {
      const mm = p.mergedAt.slice(0, 7)
      if (!monthMap.has(mm)) monthMap.set(mm, { opened: 0, merged: 0 })
      monthMap.get(mm)!.merged++
    }
  }
  const monthlyTimeline = Array.from(monthMap.entries())
    .map(([month, v]) => ({
      month,
      label: `${MONTH_NAMES[parseInt(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`,
      opened: v.opened,
      merged: v.merged,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Top repos
  const repoMap = new Map<string, { count: number; merged: number }>()
  for (const p of prs) {
    const existing = repoMap.get(p.repo) ?? { count: 0, merged: 0 }
    existing.count++
    if (p.state === 'merged') existing.merged++
    repoMap.set(p.repo, existing)
  }
  const topRepos = Array.from(repoMap.entries())
    .map(([repo, v]) => ({ repo, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    total: prs.length,
    open,
    merged,
    closed,
    mergeRate: prs.length > 0 ? merged / prs.length : 0,
    avgMergeTimeHours: Math.round(avgMergeTime),
    medianMergeTimeHours: Math.round(medianMergeTime),
    avgPRSize: avgSize,
    sizeDistribution: sizeDist,
    monthlyTimeline,
    recentPRs: prs.slice(0, 10),
    topRepos,
  }
}

// =====================
// ISSUE STATS
// =====================

export function computeIssueStats(issues: IssueInfo[]): IssueStats {
  if (issues.length === 0) {
    return {
      total: 0, open: 0, closed: 0, closeRate: 0,
      avgResolutionTimeHours: 0, medianResolutionTimeHours: 0,
      topLabels: [], monthlyTimeline: [], recentIssues: [], topRepos: [],
    }
  }

  const open = issues.filter(i => i.state === 'open').length
  const closed = issues.filter(i => i.state === 'closed').length

  const resolutionTimes = issues
    .filter(i => i.state === 'closed' && i.closedAt && i.createdAt)
    .map(i => (new Date(i.closedAt!).getTime() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60))
    .filter(h => h >= 0)
    .sort((a, b) => a - b)

  const avgRes = resolutionTimes.length > 0 ? resolutionTimes.reduce((s, h) => s + h, 0) / resolutionTimes.length : 0
  const medianRes = resolutionTimes.length > 0 ? resolutionTimes[Math.floor(resolutionTimes.length / 2)] : 0

  // Top labels
  const labelCounts = new Map<string, number>()
  for (const i of issues) {
    for (const l of i.labels) {
      labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1)
    }
  }
  const topLabels = Array.from(labelCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Monthly timeline
  const monthMap = new Map<string, { opened: number; closed: number }>()
  for (const i of issues) {
    const m = i.createdAt.slice(0, 7)
    if (!monthMap.has(m)) monthMap.set(m, { opened: 0, closed: 0 })
    monthMap.get(m)!.opened++
    if (i.state === 'closed' && i.closedAt) {
      const mm = i.closedAt.slice(0, 7)
      if (!monthMap.has(mm)) monthMap.set(mm, { opened: 0, closed: 0 })
      monthMap.get(mm)!.closed++
    }
  }
  const monthlyTimeline = Array.from(monthMap.entries())
    .map(([month, v]) => ({
      month,
      label: `${MONTH_NAMES[parseInt(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`,
      opened: v.opened,
      closed: v.closed,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Top repos
  const repoMap = new Map<string, { count: number; closed: number }>()
  for (const i of issues) {
    const existing = repoMap.get(i.repo) ?? { count: 0, closed: 0 }
    existing.count++
    if (i.state === 'closed') existing.closed++
    repoMap.set(i.repo, existing)
  }
  const topRepos = Array.from(repoMap.entries())
    .map(([repo, v]) => ({ repo, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    total: issues.length,
    open,
    closed,
    closeRate: issues.length > 0 ? closed / issues.length : 0,
    avgResolutionTimeHours: Math.round(avgRes),
    medianResolutionTimeHours: Math.round(medianRes),
    topLabels,
    monthlyTimeline,
    recentIssues: issues.slice(0, 10),
    topRepos,
  }
}

// =====================
// STARRED REPOS STATS
// =====================

export function computeStarredStats(starred: StarredRepo[]): StarredStats {
  if (starred.length === 0) {
    return { total: 0, languageDistribution: [], topStarred: [] }
  }

  const langCounts = new Map<string, number>()
  for (const r of starred) {
    const lang = r.language || 'Unknown'
    langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1)
  }
  const total = starred.length
  const languageDistribution = Array.from(langCounts.entries())
    .map(([language, count]) => ({ language, count, percentage: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topStarred = [...starred]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 15)

  return { total, languageDistribution, topStarred }
}

// =====================
// REPO METADATA STATS
// =====================

export function computeRepoMetadataStats(repos: RepoMetadata[]): RepoMetadataStats {
  if (repos.length === 0) {
    return {
      totalRepos: 0, totalStars: 0, totalForks: 0, avgStarsPerRepo: 0,
      topStarredRepos: [], forkRatio: 0, archivedCount: 0,
      topTopics: [], licenseDistribution: [],
    }
  }

  const totalStars = repos.reduce((s, r) => s + r.stars, 0)
  const totalForks = repos.reduce((s, r) => s + r.forks, 0)
  const forks = repos.filter(r => r.isFork).length
  const archived = repos.filter(r => r.isArchived).length

  const topStarred = [...repos]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 10)
    .map(r => ({ repo: r.fullName, stars: r.stars, forks: r.forks, language: r.primaryLanguage }))

  const topicCounts = new Map<string, number>()
  for (const r of repos) {
    for (const t of r.topics) {
      topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1)
    }
  }
  const topTopics = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const licenseCounts = new Map<string, number>()
  for (const r of repos) {
    const lic = r.license || 'None'
    licenseCounts.set(lic, (licenseCounts.get(lic) ?? 0) + 1)
  }
  const licenseDistribution = Array.from(licenseCounts.entries())
    .map(([license, count]) => ({ license, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalRepos: repos.length,
    totalStars,
    totalForks,
    avgStarsPerRepo: Math.round(totalStars / repos.length),
    topStarredRepos: topStarred,
    forkRatio: repos.length > 0 ? forks / repos.length : 0,
    archivedCount: archived,
    topTopics,
    licenseDistribution,
  }
}
