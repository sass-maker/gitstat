import type { AIInvolvementStats } from '../types'

const TOOL_COLORS: Record<string, string> = {
  Devin: '#3b82f6',
  Claude: '#d97706',
  'GitHub Copilot': '#6366f1',
  Cursor: '#a855f7',
  ChatGPT: '#10b981',
  Gemini: '#f59e0b',
  Codeium: '#06b6d4',
  Windsurf: '#8b5cf6',
  Aider: '#ef4444',
  Codex: '#14b8a6',
  'Unknown Bot': '#71717a',
}

function getColor(tool: string): string {
  return TOOL_COLORS[tool] || '#71717a'
}

function truncateMsg(msg: string, max = 120): string {
  const firstLine = msg.split('\n')[0]
  if (firstLine.length <= max) return firstLine
  return firstLine.slice(0, max) + '…'
}

export function AIPanel({ stats, loading }: { stats: AIInvolvementStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-32 w-full rounded-lg" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
    )
  }

  if (!stats || stats.totalCommitsScanned === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-zinc-400">No commit messages scanned yet.</p>
        <p className="text-xs text-zinc-500 mt-1">Commit data is fetched after stats load completes.</p>
      </div>
    )
  }

  const tools = Object.entries(stats.byTool).sort((a, b) => b[1] - a[1])
  const recentTimeline = stats.monthlyTimeline.slice(-12)
  const maxMonthly = Math.max(...recentTimeline.map((m) => m.total), 1)

  return (
    <div className="space-y-6">
      {/* Headline figures */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 py-2">
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Commits scanned</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-100">{stats.totalCommitsScanned.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">AI-assisted</p>
          <p className="text-xl font-semibold tabular-nums text-blue-400">{stats.aiAssistedCommits.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{stats.aiAssistedPercentage.toFixed(1)}% of scanned</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Bot co-authored</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-300">{stats.botCommits.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{stats.botPercentage.toFixed(1)}% of scanned</p>
        </div>
      </div>

      {/* AI involvement over time */}
      {recentTimeline.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-3">AI-assisted commits over time</p>
          <div className="flex items-end gap-1.5 h-28">
            {recentTimeline.map((m) => {
              const totalHeight = (m.total / maxMonthly) * 100
              const aiHeight = m.total > 0 ? (m.aiAssisted / m.total) * totalHeight : 0
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap tabular-nums">
                    {m.aiAssisted}/{m.total}
                  </div>
                  <div className="w-full relative flex items-end h-full" style={{ height: `${totalHeight}%` }}>
                    <div
                      className="w-full bg-zinc-700 rounded-t-[2px] absolute bottom-0"
                      style={{ height: `${totalHeight}%` }}
                    />
                    <div
                      className="w-full bg-blue-500 rounded-t-[2px] absolute bottom-0"
                      style={{ height: `${aiHeight}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate w-full text-center">{m.label.split(' ')[0]}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-[2px]" /> AI-assisted
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-zinc-700 rounded-[2px]" /> Total scanned
            </span>
          </div>
        </div>
      )}

      {/* Tool breakdown */}
      {tools.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Detected tools</h3>
          <div className="space-y-2">
            {tools.map(([tool, count]) => {
              const pct = stats.totalCommitsScanned > 0 ? (count / stats.totalCommitsScanned) * 100 : 0
              return (
                <div key={tool} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-[2px] flex-shrink-0" style={{ backgroundColor: getColor(tool) }} />
                  <span className="text-xs text-zinc-300 w-32 truncate">{tool}</span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: getColor(tool) }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 font-mono tabular-nums w-12 text-right">{count}</span>
                  <span className="text-[10px] text-zinc-500 font-mono tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-400">No AI-assisted commits detected.</p>
          <p className="text-xs text-zinc-500 mt-1">
            Detection scans for Co-Authored-By trailers, "Generated with" markers, and known bot patterns.
          </p>
        </div>
      )}

      {/* Recent AI commits */}
      {stats.recentAICommits.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Recent AI-assisted commits</h3>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {stats.recentAICommits.map((signal) => (
              <div key={signal.commit.sha} className="bg-zinc-900 border border-zinc-800 rounded-md p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  {signal.detected.map((d, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded-[2px] text-white"
                      style={{ backgroundColor: getColor(d.tool) }}
                    >
                      {d.tool}
                    </span>
                  ))}
                  <a
                    href={`https://github.com/${signal.commit.repo}/commit/${signal.commit.sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:text-blue-300 truncate flex-1"
                  >
                    {signal.commit.repo}
                  </a>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {signal.commit.date ? new Date(signal.commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-mono leading-relaxed">{truncateMsg(signal.commit.message)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-500">
        Detection is heuristic — scanning commit messages for Co-Authored-By trailers, "Generated with" markers,
        and known bot author patterns. May miss AI-assisted commits that don't self-identify and may false-positive
        on commits that mention AI tools in passing.
      </p>
    </div>
  )
}
