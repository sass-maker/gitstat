import type { ContributionTypes } from '../types'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

const TYPE_CONFIG: { key: keyof ContributionTypes; label: string; color: string }[] = [
  { key: 'commits', label: 'Commits', color: 'bg-blue-500' },
  { key: 'pullRequests', label: 'Pull requests', color: 'bg-emerald-500' },
  { key: 'issues', label: 'Issues', color: 'bg-amber-500' },
  { key: 'pullRequestReviews', label: 'PR reviews', color: 'bg-purple-500' },
  { key: 'repositories', label: 'Repositories', color: 'bg-zinc-500' },
]

export function ContributionTypeChart({ types }: { types: ContributionTypes }) {
  const max = Math.max(...TYPE_CONFIG.map((t) => types[t.key]), 1)

  return (
    <div className="space-y-2.5">
      {TYPE_CONFIG.map((t) => {
        const value = types[t.key]
        const width = (value / max) * 100
        return (
          <div key={t.key} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-28 flex-shrink-0">{t.label}</span>
            <div className="flex-1 h-4 bg-zinc-800/50 rounded-[2px] overflow-hidden">
              <div
                className={`h-full rounded-[2px] transition-all ${t.color}`}
                style={{ width: `${Math.max(width, value > 0 ? 2 : 0)}%` }}
              />
            </div>
            <span className="text-xs text-zinc-300 font-mono tabular-nums w-12 text-right">
              {formatNum(value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
