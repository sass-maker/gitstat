import type { PRStats } from '../types'

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
  merged: 'bg-purple-500/20 text-purple-400',
  closed: 'bg-rose-500/20 text-rose-400',
}

export function PRPanel({ stats, loading }: { stats: PRStats | null; loading: boolean }) {
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
        <p className="text-sm text-zinc-400">No pull requests found.</p>
      </div>
    )
  }

  const recentTimeline = stats.monthlyTimeline.slice(-12)
  const maxMonthly = Math.max(...recentTimeline.map((m) => Math.max(m.opened, m.merged)), 1)
  const sizeTotal = stats.sizeDistribution.small + stats.sizeDistribution.medium + stats.sizeDistribution.large + stats.sizeDistribution.veryLarge

  const sizeCards = [
    { label: 'Small', count: stats.sizeDistribution.small, sub: '<100 lines', color: 'text-emerald-400' },
    { label: 'Medium', count: stats.sizeDistribution.medium, sub: '100-500', color: 'text-blue-400' },
    { label: 'Large', count: stats.sizeDistribution.large, sub: '500-1000', color: 'text-amber-400' },
    { label: 'Very large', count: stats.sizeDistribution.veryLarge, sub: '1000+', color: 'text-rose-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Headline figures */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 py-2">
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Total PRs</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatNum(stats.total)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Open</p>
          <p className="text-xl font-semibold tabular-nums text-amber-400">{formatNum(stats.open)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Merged</p>
          <p className="text-xl font-semibold tabular-nums text-purple-400">{formatNum(stats.merged)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Closed</p>
          <p className="text-xl font-semibold tabular-nums text-rose-400">{formatNum(stats.closed)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Merge rate</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-400">{stats.mergeRate.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Avg merge time</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatDuration(stats.avgMergeTimeHours)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Median merge</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatDuration(stats.medianMergeTimeHours)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Avg PR size</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatNum(stats.avgPRSize)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">lines changed</p>
        </div>
      </div>

      {/* Size distribution */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        {sizeCards.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] text-zinc-500 mb-0.5">{s.label}</p>
            <p className={`text-sm font-semibold tabular-nums ${s.color}`}>{formatNum(s.count)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {s.sub} · {sizeTotal > 0 ? ((s.count / sizeTotal) * 100).toFixed(0) : 0}%
            </p>
          </div>
        ))}
      </div>

      {/* Monthly timeline */}
      {recentTimeline.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-3">Opened vs merged per month</p>
          <div className="flex items-end gap-1.5 h-28">
            {recentTimeline.map((m) => {
              const openedHeight = (m.opened / maxMonthly) * 100
              const mergedHeight = (m.merged / maxMonthly) * 100
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap tabular-nums">
                    {m.opened}/{m.merged}
                  </div>
                  <div className="w-full flex items-end h-full gap-px">
                    <div
                      className="flex-1 bg-blue-500/70 rounded-tl-[2px] transition-colors hover:bg-blue-400"
                      style={{ height: `${Math.max(openedHeight, m.opened > 0 ? 3 : 0)}%` }}
                    />
                    <div
                      className="flex-1 bg-purple-500/70 rounded-tr-[2px] transition-colors hover:bg-purple-400"
                      style={{ height: `${Math.max(mergedHeight, m.merged > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate w-full text-center">{m.label.split(' ')[0]}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-blue-500/70 rounded-[2px]" /> Opened
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-purple-500/70 rounded-[2px]" /> Merged
            </span>
          </div>
        </div>
      )}

      {/* Top repos */}
      {stats.topRepos.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Top repos by PR count</h3>
          <div className="space-y-1">
            {stats.topRepos.slice(0, 5).map((r) => (
              <div key={r.repo} className="flex items-center gap-3 text-xs">
                <a
                  href={`https://github.com/${r.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline truncate flex-1"
                >
                  {r.repo}
                </a>
                <span className="text-zinc-300 font-mono tabular-nums w-12 text-right">{r.count}</span>
                <span className="text-emerald-400 font-mono tabular-nums w-12 text-right">{r.merged}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent PRs */}
      {stats.recentPRs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Recent PRs</h3>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {stats.recentPRs.slice(0, 15).map((pr) => (
              <div key={`${pr.repo}-${pr.number}`} className="bg-zinc-900 border border-zinc-800 rounded-md p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] font-medium ${STATE_STYLES[pr.state]}`}>
                    {pr.state}
                  </span>
                  <a
                    href={`https://github.com/${pr.repo}/pull/${pr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:text-blue-300 truncate flex-1"
                  >
                    {pr.repo}
                  </a>
                  <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                    {pr.changedFiles} files · +{formatNum(pr.additions)}/-{formatNum(pr.deletions)}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 truncate">{pr.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
