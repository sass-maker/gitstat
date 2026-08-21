import type { TimePatterns } from '../types'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function hourColor(hour: number): string {
  if (hour < 6) return 'bg-indigo-500/70'
  if (hour < 12) return 'bg-amber-500/70'
  if (hour < 18) return 'bg-blue-500/70'
  return 'bg-emerald-500/70'
}

function hourLabel(hour: number): string {
  if (hour < 6) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function TimePatternsPanel({ patterns }: { patterns: TimePatterns }) {
  const maxHour = Math.max(...patterns.hourOfDay, 1)
  const maxDay = Math.max(...patterns.dayOfWeek, 1)
  const totalCommits = patterns.hourOfDay.reduce((s, c) => s + c, 0)

  const summary = [
    { label: 'Morning', value: patterns.morningCommits, color: 'text-amber-400' },
    { label: 'Afternoon', value: patterns.afternoonCommits, color: 'text-blue-400' },
    { label: 'Evening', value: patterns.eveningCommits, color: 'text-emerald-400' },
    { label: 'Night', value: patterns.nightCommits, color: 'text-indigo-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Time of day chart */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Time of day</p>
        <div className="flex items-end gap-px h-24">
          {patterns.hourOfDay.map((count, hour) => {
            const height = (count / maxHour) * 100
            return (
              <div
                key={hour}
                className="flex-1 flex flex-col items-center group relative"
                title={`${hour}:00 — ${count} commits (${hourLabel(hour)})`}
              >
                <div
                  className={`w-full rounded-t-[2px] transition-opacity ${hourColor(hour)} ${count === 0 ? 'opacity-20' : 'opacity-100'}`}
                  style={{ height: `${Math.max(height, count > 0 ? 3 : 1)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
        <p className="text-[10px] text-zinc-500 mt-2">
          Peak hour: <span className="text-zinc-300 tabular-nums">{patterns.peakHour}:00</span>
        </p>
      </div>

      {/* Day of week chart */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Day of week</p>
        <div className="flex items-end gap-2 h-24">
          {patterns.dayOfWeek.map((count, day) => {
            const height = (count / maxDay) * 100
            const isWeekend = day === 0 || day === 6
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                <div className="text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 whitespace-nowrap tabular-nums">
                  {formatNum(count)}
                </div>
                <div
                  className={`w-full rounded-t-[2px] transition-colors ${isWeekend ? 'bg-purple-500/70 hover:bg-purple-400' : 'bg-blue-500/70 hover:bg-blue-400'}`}
                  style={{ height: `${Math.max(height, count > 0 ? 3 : 1)}%` }}
                />
                <span className="text-[10px] text-zinc-500">{DAY_LABELS[day]}</span>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-zinc-500 mt-2">
          Peak day: <span className="text-zinc-300">{DAY_LABELS[patterns.peakDay]}</span>
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        {summary.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] text-zinc-500 mb-0.5">{s.label}</p>
            <p className={`text-sm font-semibold tabular-nums ${s.color}`}>{formatNum(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Weekday/weekend split + scores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Weekday</p>
          <p className="text-sm font-semibold text-zinc-100 tabular-nums">{formatNum(patterns.weekdayCommits)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {totalCommits > 0 ? `${((patterns.weekdayCommits / totalCommits) * 100).toFixed(0)}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Weekend</p>
          <p className="text-sm font-semibold text-zinc-100 tabular-nums">{formatNum(patterns.weekendCommits)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {totalCommits > 0 ? `${((patterns.weekendCommits / totalCommits) * 100).toFixed(0)}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Night owl</p>
          <p className="text-sm font-semibold text-indigo-400 tabular-nums">{patterns.nightOwlScore}/100</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Weekend warrior</p>
          <p className="text-sm font-semibold text-purple-400 tabular-nums">{patterns.weekendWarriorScore}/100</p>
        </div>
      </div>
    </div>
  )
}
