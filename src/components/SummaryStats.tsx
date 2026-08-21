import type { SummaryStats } from '../types'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function SummaryStatsCard({ stats }: { stats: SummaryStats }) {
  const items = [
    { label: 'Peak month', value: stats.peakMonth?.label || '—', sub: stats.peakMonth ? `${stats.peakMonth.commits} commits` : '' },
    { label: 'Longest streak', value: `${stats.longestStreak} days`, sub: 'consecutive active days' },
    { label: 'Current streak', value: `${stats.currentStreak} days`, sub: stats.currentStreak > 0 ? 'still going' : 'inactive' },
    { label: 'Avg per week', value: `${stats.avgCommitsPerWeek}`, sub: 'commits' },
    { label: 'Active days', value: `${stats.totalActiveDays}`, sub: 'days with commits' },
    { label: 'Most active day', value: stats.mostActiveDay ? formatDate(stats.mostActiveDay.date) : '—', sub: stats.mostActiveDay ? `${Math.round(stats.mostActiveDay.commits)} commits` : '' },
    { label: 'First commit', value: formatDate(stats.firstCommitDate), sub: '' },
    { label: 'Latest commit', value: formatDate(stats.lastCommitDate), sub: '' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs text-zinc-500 mb-0.5">{item.label}</p>
          <p className="text-sm font-semibold text-zinc-100 tabular-nums">{item.value}</p>
          {item.sub && <p className="text-[10px] text-zinc-500 mt-0.5">{item.sub}</p>}
        </div>
      ))}
    </div>
  )
}
