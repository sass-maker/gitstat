import type { CollaborationStats } from '../types'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

export function CollaborationPanel({ stats }: { stats: CollaborationStats }) {
  const total = stats.soloCommits + stats.totalCoAuthored
  const soloPct = total > 0 ? (stats.soloCommits / total) * 100 : 0
  const coPct = total > 0 ? (stats.totalCoAuthored / total) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Solo vs co-authored split bar */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs text-zinc-500">Solo vs co-authored</p>
          <p className="text-xs text-zinc-300 tabular-nums">
            {stats.pairRatio.toFixed(1)}% pair ratio
          </p>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800">
          {total > 0 && (
            <>
              <div className="bg-blue-500/70" style={{ width: `${soloPct}%` }} title={`Solo: ${stats.soloCommits}`} />
              <div className="bg-emerald-500/70" style={{ width: `${coPct}%` }} title={`Co-authored: ${stats.totalCoAuthored}`} />
            </>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-blue-500/70 rounded-[2px]" />
            Solo ({formatNum(stats.soloCommits)} · {soloPct.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-emerald-500/70 rounded-[2px]" />
            Co-authored ({formatNum(stats.totalCoAuthored)} · {coPct.toFixed(0)}%)
          </span>
        </div>
      </div>

      {/* Top collaborators */}
      {stats.topCollaborators.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Top collaborators</h3>
          <div className="space-y-1.5">
            {stats.topCollaborators.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2"
              >
                <span className="text-xs text-blue-400 truncate flex-1">{c.name}</span>
                <span className="text-xs text-zinc-300 font-mono tabular-nums">
                  {formatNum(c.count)} commits
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {c.repos} {c.repos === 1 ? 'repo' : 'repos'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-400">Primarily solo work — no co-authors detected.</p>
        </div>
      )}
    </div>
  )
}
