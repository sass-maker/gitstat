import type { IssueStats } from '../types'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

function formatDuration(hours: number): string {
  if (hours <= 0) return '—'
  if (hours >= 720) return `${(hours / 720).toFixed(1)}mo`
  if (hours >= 24) return `${Math.round(hours / 24)}d`
  return `${Math.round(hours)}h`
}

const STATE_STYLES: Record<string, string> = {
  open: 'bg-amber-500/20 text-amber-400',
  closed: 'bg-emerald-500/20 text-emerald-400',
}

export function IssuePanel({ stats, loading }: { stats: IssueStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-32 w-full rounded-lg" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
    )
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-zinc-400">No issues found.</p>
      </div>
    )
  }

  const recentTimeline = stats.monthlyTimeline.slice(-12)
  const maxMonthly = Math.max(...recentTimeline.map((m) => Math.max(m.opened, m.closed)), 1)

  return (
    <div className="space-y-6">
      {/* Headline figures */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 py-2">
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Total issues</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatNum(stats.total)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Open</p>
          <p className="text-xl font-semibold tabular-nums text-amber-400">{formatNum(stats.open)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Closed</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-400">{formatNum(stats.closed)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Close rate</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-400">{stats.closeRate.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Avg resolution</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatDuration(stats.avgResolutionTimeHours)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Median resolution</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatDuration(stats.medianResolutionTimeHours)}</p>
        </div>
      </div>

      {/* Monthly timeline */}
      {recentTimeline.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-3">Opened vs closed per month</p>
          <div className="flex items-end gap-1.5 h-28">
            {recentTimeline.map((m) => {
              const openedHeight = (m.opened / maxMonthly) * 100
              const closedHeight = (m.closed / maxMonthly) * 100
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap tabular-nums">
                    {m.opened}/{m.closed}
                  </div>
                  <div className="w-full flex items-end h-full gap-px">
                    <div
                      className="flex-1 bg-amber-500/70 rounded-tl-[2px] transition-colors hover:bg-amber-400"
                      style={{ height: `${Math.max(openedHeight, m.opened > 0 ? 3 : 0)}%` }}
                    />
                    <div
                      className="flex-1 bg-emerald-500/70 rounded-tr-[2px] transition-colors hover:bg-emerald-400"
                      style={{ height: `${Math.max(closedHeight, m.closed > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate w-full text-center">{m.label.split(' ')[0]}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-amber-500/70 rounded-[2px]" /> Opened
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-500/70 rounded-[2px]" /> Closed
            </span>
          </div>
        </div>
      )}

      {/* Top labels */}
      {stats.topLabels.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Top labels</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topLabels.slice(0, 12).map((l) => (
              <span
                key={l.label}
                className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
              >
                {l.label}
                <span className="text-zinc-500 ml-1 tabular-nums">{l.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top repos */}
      {stats.topRepos.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Top repos by issue count</h3>
          <div className="space-y-1">
            {stats.topRepos.slice(0, 5).map((r) => (
              <div key={r.repo} className="flex items-center gap-3 text-xs">
                <a
                  href={`https://github.com/${r.repo}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline truncate flex-1"
                >
                  {r.repo}
                </a>
                <span className="text-zinc-300 font-mono tabular-nums w-12 text-right">{r.count}</span>
                <span className="text-emerald-400 font-mono tabular-nums w-12 text-right">{r.closed}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent issues */}
      {stats.recentIssues.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Recent issues</h3>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {stats.recentIssues.slice(0, 15).map((issue) => (
              <div key={`${issue.repo}-${issue.number}`} className="bg-zinc-900 border border-zinc-800 rounded-md p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] font-medium ${STATE_STYLES[issue.state]}`}>
                    {issue.state}
                  </span>
                  <a
                    href={`https://github.com/${issue.repo}/issues/${issue.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:text-blue-300 truncate flex-1"
                  >
                    {issue.repo}
                  </a>
                  {issue.labels.length > 0 && (
                    <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                      {issue.labels.join(', ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-300 truncate">{issue.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
