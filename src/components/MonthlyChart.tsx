import type { MonthlyData } from '../types'
import { getRecentMonths } from '../lib/analytics'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

export function MonthlyChart({ monthlyData }: { monthlyData: MonthlyData[] }) {
  const recent = getRecentMonths(monthlyData, 12)
  if (recent.length === 0) return null

  const maxCommits = Math.max(...recent.map((m) => m.commits), 1)
  const maxLines = Math.max(...recent.map((m) => Math.max(m.additions, m.deletions)), 1)

  return (
    <div className="space-y-8">
      {/* Commits bar chart */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Commits per month</p>
        <div className="flex items-end gap-1.5 h-28">
          {recent.map((m) => {
            const height = (m.commits / maxCommits) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap tabular-nums">
                  {m.commits.toLocaleString()}
                </div>
                <div
                  className="w-full bg-blue-600 rounded-t-[2px] transition-colors hover:bg-blue-500"
                  style={{ height: `${Math.max(height, 1)}%` }}
                />
                <span className="text-[10px] text-zinc-500 truncate w-full text-center">{m.label.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Additions / Deletions chart */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Lines changed per month</p>
        <div className="flex items-end gap-1.5 h-28">
          {recent.map((m) => {
            const addHeight = (m.additions / maxLines) * 100
            const delHeight = (m.deletions / maxLines) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap tabular-nums">
                  +{formatNum(m.additions)} / -{formatNum(m.deletions)}
                </div>
                <div className="w-full flex items-end h-full gap-px">
                  <div
                    className="flex-1 bg-emerald-600/70 rounded-tl-[2px] transition-colors hover:bg-emerald-500"
                    style={{ height: `${Math.max(addHeight, 1)}%` }}
                  />
                  <div
                    className="flex-1 bg-rose-600/70 rounded-tr-[2px] transition-colors hover:bg-rose-500"
                    style={{ height: `${Math.max(delHeight, 1)}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 truncate w-full text-center">{m.label.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-emerald-600/70 rounded-[2px]" /> Additions
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-rose-600/70 rounded-[2px]" /> Deletions
          </span>
        </div>
      </div>
    </div>
  )
}
