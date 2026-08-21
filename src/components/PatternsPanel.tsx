import type { CommitPatterns } from '../types'

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export function PatternsPanel({ patterns }: { patterns: CommitPatterns }) {
  const { focusConcentration: focus, commitSizeDistribution: sizes, repoActivity: activity, cadence, commitQuality } = patterns
  const totalSizes = sizes.small + sizes.medium + sizes.large + sizes.veryLarge

  return (
    <div className="space-y-8">
      {/* Focus concentration */}
      <section>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Focus concentration</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 mb-4">
          <div>
            <p className="text-[10px] text-zinc-500 mb-0.5">Top repo</p>
            <p className="text-sm font-semibold text-blue-400 truncate">{focus.topRepo}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{formatPct(focus.topRepoShare)} of commits</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 mb-0.5">Top 5 repos</p>
            <p className="text-sm font-semibold text-zinc-100 tabular-nums">{formatPct(focus.top5Share)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 mb-0.5">Top 10 repos</p>
            <p className="text-sm font-semibold text-zinc-100 tabular-nums">{formatPct(focus.top10Share)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 mb-0.5">Gini coefficient</p>
            <p className="text-sm font-semibold text-zinc-100 tabular-nums">{focus.giniCoefficient.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {focus.giniCoefficient > 0.7 ? 'highly concentrated' : focus.giniCoefficient > 0.4 ? 'moderate focus' : 'evenly spread'}
            </p>
          </div>
        </div>
        {/* Concentration bar */}
        <div className="space-y-1.5">
          <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
            <div className="bg-blue-500" style={{ width: `${focus.topRepoShare}%` }} />
            <div className="bg-blue-600/70" style={{ width: `${focus.top5Share - focus.topRepoShare}%` }} />
            <div className="bg-blue-700/50" style={{ width: `${focus.top10Share - focus.top5Share}%` }} />
            <div className="bg-zinc-600" style={{ width: `${100 - focus.top10Share}%` }} />
          </div>
          <div className="flex gap-4 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-[2px]" /> Top repo</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-600/70 rounded-[2px]" /> Repos 2-5</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-700/50 rounded-[2px]" /> Repos 6-10</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-zinc-600 rounded-[2px]" /> Rest</span>
          </div>
        </div>
      </section>

      {/* Commit size distribution */}
      <section>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Commit size distribution</h3>
        <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800">
          {totalSizes > 0 && (
            <>
              <div className="bg-emerald-600/70" style={{ width: `${(sizes.small / totalSizes) * 100}%` }} title={`Small: ${sizes.small}`} />
              <div className="bg-blue-600/70" style={{ width: `${(sizes.medium / totalSizes) * 100}%` }} title={`Medium: ${sizes.medium}`} />
              <div className="bg-amber-600/70" style={{ width: `${(sizes.large / totalSizes) * 100}%` }} title={`Large: ${sizes.large}`} />
              <div className="bg-rose-600/70" style={{ width: `${(sizes.veryLarge / totalSizes) * 100}%` }} title={`Very large: ${sizes.veryLarge}`} />
            </>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-3">
          <SizeBucket label="Small" sub="<10 lines" count={sizes.small} total={totalSizes} color="bg-emerald-600/70" />
          <SizeBucket label="Medium" sub="10-100 lines" count={sizes.medium} total={totalSizes} color="bg-blue-600/70" />
          <SizeBucket label="Large" sub="100-500 lines" count={sizes.large} total={totalSizes} color="bg-amber-600/70" />
          <SizeBucket label="Very large" sub="500+ lines" count={sizes.veryLarge} total={totalSizes} color="bg-rose-600/70" />
        </div>
        <p className="text-[10px] text-zinc-500 mt-2">
          Approximated from weekly churn ÷ weekly commits. Individual commit sizes not available from the stats API.
        </p>
      </section>

      {/* Repository activity */}
      <section>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Repository activity</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
          <ActivityBucket label="Active" sub="last 30 days" count={activity.active} color="text-emerald-400" />
          <ActivityBucket label="Recent" sub="last 90 days" count={activity.recent} color="text-blue-400" />
          <ActivityBucket label="Stale" sub="last year" count={activity.stale} color="text-amber-400" />
          <ActivityBucket label="Dormant" sub="over a year" count={activity.dormant} color="text-zinc-500" />
        </div>
      </section>

      {/* Cadence */}
      <section>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Commit cadence</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
          <div>
            <p className="text-[10px] text-zinc-500 mb-0.5">Avg/active week</p>
            <p className="text-sm font-semibold text-zinc-100 tabular-nums">{cadence.avgCommitsPerActiveWeek}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 mb-0.5">Median/week</p>
            <p className="text-sm font-semibold text-zinc-100 tabular-nums">{cadence.medianWeeklyCommits}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 mb-0.5">Max/week</p>
            <p className="text-sm font-semibold text-zinc-100 tabular-nums">{cadence.maxWeeklyCommits}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 mb-0.5">Burst weeks</p>
            <p className="text-sm font-semibold text-zinc-100 tabular-nums">{cadence.burstWeeks}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{'>'}2× average</p>
          </div>
        </div>
      </section>

      {/* Commit quality */}
      {commitQuality.sampled > 0 && (
        <section>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Commit message quality</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 mb-4">
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Avg message length</p>
              <p className="text-sm font-semibold text-zinc-100 tabular-nums">{commitQuality.avgMsgLen} chars</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Meaningful ratio</p>
              <p className="text-sm font-semibold text-emerald-400 tabular-nums">{(commitQuality.meaningfulRatio * 100).toFixed(0)}%</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">conventional or {'\u2265'}30 chars</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Meaningful</p>
              <p className="text-sm font-semibold text-emerald-400 tabular-nums">{commitQuality.meaningfulCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Trivial</p>
              <p className="text-sm font-semibold text-amber-400 tabular-nums">{commitQuality.trivialCount.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">wip, fix, tmp, etc.</p>
            </div>
          </div>
          {/* Meaningful vs trivial bar */}
          <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800">
            <div className="bg-emerald-600/70" style={{ width: `${commitQuality.meaningfulRatio * 100}%` }} />
            <div className="bg-amber-600/70" style={{ width: `${(1 - commitQuality.meaningfulRatio) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-600/70 rounded-[2px]" /> Meaningful ({(commitQuality.meaningfulRatio * 100).toFixed(0)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-amber-600/70 rounded-[2px]" /> Trivial ({((1 - commitQuality.meaningfulRatio) * 100).toFixed(0)}%)
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">
            Based on {commitQuality.sampled.toLocaleString()} sampled commit messages. "Trivial" = wip, tmp, fix, asdf, merge branch, etc.
          </p>
        </section>
      )}
    </div>
  )
}

function SizeBucket({ label, sub, count, total, color }: { label: string; sub: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className={`w-2.5 h-2.5 rounded-[2px] ${color}`} />
        <p className="text-[10px] text-zinc-400">{label}</p>
      </div>
      <p className="text-sm font-semibold text-zinc-100 tabular-nums">{count.toLocaleString()}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">{sub} · {pct.toFixed(1)}%</p>
    </div>
  )
}

function ActivityBucket({ label, sub, count, color }: { label: string; sub: string; count: number; color: string }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${color}`}>{count}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>
    </div>
  )
}
