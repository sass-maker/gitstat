import type { ConventionalCommitBreakdown } from '../types'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

const TYPE_CONFIG: { key: keyof ConventionalCommitBreakdown; label: string; color: string }[] = [
  { key: 'feat', label: 'feat', color: 'bg-emerald-500' },
  { key: 'fix', label: 'fix', color: 'bg-rose-500' },
  { key: 'chore', label: 'chore', color: 'bg-zinc-500' },
  { key: 'docs', label: 'docs', color: 'bg-blue-400' },
  { key: 'test', label: 'test', color: 'bg-amber-500' },
  { key: 'refactor', label: 'refactor', color: 'bg-purple-500' },
  { key: 'perf', label: 'perf', color: 'bg-cyan-500' },
  { key: 'style', label: 'style', color: 'bg-pink-500' },
  { key: 'ci', label: 'ci', color: 'bg-orange-500' },
  { key: 'build', label: 'build', color: 'bg-yellow-600' },
  { key: 'revert', label: 'revert', color: 'bg-red-700' },
  { key: 'nonConventional', label: 'non-conventional', color: 'bg-zinc-600' },
]

export function ConventionalCommitChart({ breakdown }: { breakdown: ConventionalCommitBreakdown }) {
  const total = breakdown.total
  const max = Math.max(...TYPE_CONFIG.map((t) => breakdown[t.key] as number), 1)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-zinc-500">Total analyzed</span>
        <span className="text-sm font-semibold text-zinc-100 tabular-nums">{formatNum(total)}</span>
      </div>
      <div className="space-y-2">
        {TYPE_CONFIG.map((t) => {
          const value = breakdown[t.key] as number
          if (value === 0) return null
          const width = (value / max) * 100
          const pct = total > 0 ? (value / total) * 100 : 0
          return (
            <div key={t.key} className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 w-28 flex-shrink-0 truncate">{t.label}</span>
              <div className="flex-1 h-4 bg-zinc-800/50 rounded-[2px] overflow-hidden">
                <div
                  className={`h-full rounded-[2px] transition-all ${t.color}`}
                  style={{ width: `${Math.max(width, 2)}%` }}
                />
              </div>
              <span className="text-xs text-zinc-300 font-mono tabular-nums w-12 text-right">
                {formatNum(value)}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono tabular-nums w-12 text-right">
                {pct.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
