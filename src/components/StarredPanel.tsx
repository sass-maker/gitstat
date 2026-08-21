import type { StarredStats, RepoMetadataStats, ActivityEvent } from '../types'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

export function StarredPanel({
  stats,
  repoMetaStats,
  events,
  loading,
}: {
  stats: StarredStats | null
  repoMetaStats: RepoMetadataStats | null
  events: ActivityEvent[]
  loading: boolean
}) {
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
        <p className="text-sm text-zinc-400">No starred repositories found.</p>
      </div>
    )
  }

  const maxLangCount = Math.max(...stats.languageDistribution.map((l) => l.count), 1)

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 py-2">
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Starred repos</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatNum(stats.total)}</p>
        </div>
        {repoMetaStats && (
          <>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Stars earned</p>
              <p className="text-xl font-semibold tabular-nums text-amber-400">{formatNum(repoMetaStats.totalStars)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Total forks</p>
              <p className="text-xl font-semibold tabular-nums text-zinc-100">{formatNum(repoMetaStats.totalForks)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Avg stars/repo</p>
              <p className="text-xl font-semibold tabular-nums text-zinc-100">{repoMetaStats.avgStarsPerRepo.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Fork ratio</p>
              <p className="text-xl font-semibold tabular-nums text-zinc-100">{repoMetaStats.forkRatio.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Archived</p>
              <p className="text-xl font-semibold tabular-nums text-zinc-500">{repoMetaStats.archivedCount}</p>
            </div>
          </>
        )}
      </div>

      {/* Language distribution */}
      {stats.languageDistribution.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Starred by language</h3>
          <div className="space-y-1.5">
            {stats.languageDistribution.slice(0, 10).map((l) => (
              <div key={l.language} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-28 flex-shrink-0 truncate">{l.language}</span>
                <div className="flex-1 h-3 bg-zinc-800/50 rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-blue-500/70 rounded-[2px]"
                    style={{ width: `${(l.count / maxLangCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-300 font-mono tabular-nums w-10 text-right">{l.count}</span>
                <span className="text-[10px] text-zinc-500 font-mono tabular-nums w-10 text-right">
                  {l.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top starred repos */}
      {stats.topStarred.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Top starred repos</h3>
          <div className="space-y-1">
            {stats.topStarred.slice(0, 10).map((r) => (
              <div key={r.fullName} className="flex items-center gap-3 text-xs">
                <a
                  href={`https://github.com/${r.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline truncate flex-1"
                >
                  {r.fullName}
                </a>
                {r.language && (
                  <span className="text-[10px] text-zinc-500 truncate max-w-[80px]">{r.language}</span>
                )}
                <span className="text-amber-400 font-mono tabular-nums w-12 text-right">{formatNum(r.stars)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repo metadata stats */}
      {repoMetaStats && (
        <>
          {/* Top topics */}
          {repoMetaStats.topTopics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">Top topics</h3>
              <div className="flex flex-wrap gap-2">
                {repoMetaStats.topTopics.slice(0, 15).map((t) => (
                  <span
                    key={t.topic}
                    className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
                  >
                    {t.topic}
                    <span className="text-zinc-500 ml-1 tabular-nums">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* License distribution */}
          {repoMetaStats.licenseDistribution.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">Licenses</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {repoMetaStats.licenseDistribution.map((l) => (
                  <div key={l.license} className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-300 truncate flex-1">{l.license}</span>
                    <span className="text-zinc-500 font-mono tabular-nums">{l.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top starred own repos */}
          {repoMetaStats.topStarredRepos.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">Top starred own repos</h3>
              <div className="space-y-1">
                {repoMetaStats.topStarredRepos.slice(0, 10).map((r) => (
                  <div key={r.repo} className="flex items-center gap-3 text-xs">
                    <a
                      href={`https://github.com/${r.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline truncate flex-1"
                    >
                      {r.repo}
                    </a>
                    {r.language && (
                      <span className="text-[10px] text-zinc-500 truncate max-w-[80px]">{r.language}</span>
                    )}
                    <span className="text-amber-400 font-mono tabular-nums w-12 text-right">{formatNum(r.stars)}</span>
                    <span className="text-zinc-400 font-mono tabular-nums w-12 text-right">{formatNum(r.forks)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Recent activity */}
      {events.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Recent activity</h3>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {events.slice(0, 15).map((e, i) => (
              <div key={`${e.repo}-${e.createdAt}-${i}`} className="bg-zinc-900 border border-zinc-800 rounded-md p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] bg-zinc-700 text-zinc-300 font-medium">
                    {e.type}
                  </span>
                  <a
                    href={`https://github.com/${e.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:text-blue-300 truncate flex-1"
                  >
                    {e.repo}
                  </a>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
                {e.summary && <p className="text-xs text-zinc-300 truncate">{e.summary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
