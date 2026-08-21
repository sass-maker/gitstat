import type { ChurnStats } from '../types'
import { getRecentMonths } from '../lib/analytics'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

const TREND_LABELS: Record<string, { text: string; color: string }> = {
  increasing: { text: '↑ increasing', color: 'text-amber-400' },
  decreasing: { text: '↓ decreasing', color: 'text-blue-400' },
  stable: { text: '→ stable', color: 'text-zinc-400' },
}

export function ChurnPanel({ stats }: { stats: ChurnStats }) {
  const recent = getRecentMonths(stats.monthly as any, 12)
  const maxChurn = Math.max(...recent.map((m: any) => m.grossChurn), 1)
  const maxNet = Math.max(...recent.map((m: any) => Math.abs(m.netChurn)), 1)

  const trend = TREND_LABELS[stats.recentTrend]

  return (
    <div className="space-y-6">
      {/* Summary figures */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 py-2">
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Avg churn/commit</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{stats.avgChurnPerCommit}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Volatility (σ)</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatNum(stats.churnVolatility)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Peak churn</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">
            {stats.peakChurnMonth ? formatNum(stats.peakChurnMonth.grossChurn) : '—'}
          </p>
          {stats.peakChurnMonth && (
            <p className="text-[10px] text-zinc-500 mt-0.5">{stats.peakChurnMonth.label}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">3-mo trend</p>
          <p className={`text-xl font-semibold ${trend.color}`}>{trend.text}</p>
        </div>
      </div>

      {/* Gross churn chart */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Gross churn per month (lines added + deleted)</p>
        <div className="flex items-end gap-1.5 h-28">
          {recent.map((m: any) => {
            const height = (m.grossChurn / maxChurn) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap tabular-nums">
                  {formatNum(m.grossChurn)}
                </div>
                <div
                  className="w-full bg-amber-600/70 rounded-t-[2px] transition-colors hover:bg-amber-500"
                  style={{ height: `${Math.max(height, 1)}%` }}
                />
                <span className="text-[10px] text-zinc-500 truncate w-full text-center">{m.label.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Net churn chart (diverging) */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Net churn per month (added − deleted)</p>
        <div className="relative h-32">
          <div className="absolute left-0 right-0 top-1/2 border-t border-zinc-700" />
          <div className="flex items-center gap-1.5 h-full">
            {recent.map((m: any) => {
              const ratio = m.netChurn / maxNet
              const isPositive = m.netChurn >= 0
              const height = Math.abs(ratio) * 50
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center justify-center gap-1.5 group relative h-full">
                  <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 whitespace-nowrap tabular-nums z-10">
                    {isPositive ? '+' : ''}{formatNum(m.netChurn)}
                  </div>
                  <div className="w-full flex-1 flex items-center justify-center">
                    {isPositive ? (
                      <div
                        className="w-full bg-emerald-600/60 rounded-t-[2px] transition-colors hover:bg-emerald-500"
                        style={{ height: `${Math.max(height, 0.5)}%` }}
                      />
                    ) : (
                      <div className="w-full flex items-end justify-center h-full">
                        <div
                          className="w-full bg-rose-600/60 rounded-b-[2px] transition-colors hover:bg-rose-500"
                          style={{ height: `${Math.max(height, 0.5)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate w-full text-center">{m.label.split(' ')[0]}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-emerald-600/60 rounded-[2px]" /> Net positive
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-rose-600/60 rounded-[2px]" /> Net negative
          </span>
        </div>
      </div>

      {/* Churn per commit ratio */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Churn per commit (lines changed ÷ commits)</p>
        <div className="flex items-end gap-1.5 h-20">
          {recent.map((m: any) => {
            const max = Math.max(...recent.map((rm: any) => rm.churnPerCommit), 1)
            const height = (m.churnPerCommit / max) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 whitespace-nowrap tabular-nums">
                  {m.churnPerCommit}
                </div>
                <div
                  className="w-full bg-blue-600/60 rounded-t-[2px] transition-colors hover:bg-blue-500"
                  style={{ height: `${Math.max(height, 1)}%` }}
                />
                <span className="text-[10px] text-zinc-500 truncate w-full text-center">{m.label.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top churn repos */}
      {stats.topChurnRepos.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Highest churn repos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="text-left py-1.5 pr-4 font-normal">Repository</th>
                  <th className="text-right py-1.5 px-3 font-normal">Churn</th>
                  <th className="text-right py-1.5 px-3 font-normal">Commits</th>
                  <th className="text-right py-1.5 pl-3 font-normal">Churn/commit</th>
                </tr>
              </thead>
              <tbody>
                {stats.topChurnRepos.map((r) => (
                  <tr key={r.repo} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                    <td className="py-1.5 pr-4 text-blue-400">
                      <a href={`https://github.com/${r.repo}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {r.repo}
                      </a>
                    </td>
                    <td className="text-right py-1.5 px-3 font-mono tabular-nums text-amber-400">{formatNum(r.churn)}</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{r.commits.toLocaleString()}</td>
                    <td className="text-right py-1.5 pl-3 font-mono tabular-nums text-zinc-300">
                      {r.commits > 0 ? Math.round(r.churn / r.commits) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
