import type { GapAnalysis } from '../types'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function GapAnalysisPanel({ analysis }: { analysis: GapAnalysis }) {
  if (!analysis.longestGap && analysis.topGaps.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <p className="text-sm text-zinc-400">No significant gaps — consistent contributor!</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Longest gap</p>
          <p className="text-sm font-semibold text-amber-400 tabular-nums">
            {analysis.longestGap ? `${analysis.longestGap.days}d` : '—'}
          </p>
          {analysis.longestGap && (
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {formatDate(analysis.longestGap.startDate)} → {formatDate(analysis.longestGap.endDate)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Inactive days</p>
          <p className="text-sm font-semibold text-zinc-100 tabular-nums">{analysis.totalInactiveDays}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Avg gap</p>
          <p className="text-sm font-semibold text-zinc-100 tabular-nums">{analysis.avgGapDays.toFixed(1)}d</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Gaps found</p>
          <p className="text-sm font-semibold text-zinc-100 tabular-nums">{analysis.topGaps.length}</p>
        </div>
      </div>

      {/* Top gaps list */}
      {analysis.topGaps.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Top gaps</h3>
          <div className="space-y-1.5">
            {analysis.topGaps.slice(0, 5).map((gap, i) => (
              <div
                key={`${gap.startDate}-${i}`}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2"
              >
                <span className="text-[10px] text-zinc-500 font-mono tabular-nums w-4">#{i + 1}</span>
                <span className="text-xs text-zinc-300 flex-1">
                  {formatDate(gap.startDate)} → {formatDate(gap.endDate)}
                </span>
                <span className="text-xs font-semibold text-amber-400 font-mono tabular-nums">
                  {gap.days}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
