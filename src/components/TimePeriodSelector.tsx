import type { TimePeriod, FilterSettings } from '../lib/filters'

const PERIOD_LABELS: Record<TimePeriod, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '1y': '1 year',
  all: 'All time',
}

interface TimePeriodSelectorProps {
  filters: FilterSettings
  onChange: (filters: FilterSettings) => void
}

export function TimePeriodSelector({ filters, onChange }: TimePeriodSelectorProps) {
  const setPeriod = (period: TimePeriod) => onChange({ ...filters, period })

  return (
    <div className="flex items-center gap-1 bg-zinc-900 rounded-md p-1">
      {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            filters.period === p
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  )
}
