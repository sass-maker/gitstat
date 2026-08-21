import type { DayData } from '../types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getIntensity(commits: number, max: number): number {
  if (commits === 0) return 0
  const ratio = commits / max
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

const INTENSITY_COLORS = [
  'bg-zinc-800',
  'bg-blue-900',
  'bg-blue-700',
  'bg-blue-500',
  'bg-blue-400',
]

export function Heatmap({ dailyData }: { dailyData: Map<string, DayData> }) {
  if (dailyData.size === 0) return null

  const dates = [...dailyData.keys()].sort()
  const lastDate = new Date(dates[dates.length - 1])
  lastDate.setHours(0, 0, 0, 0)

  const end = new Date(lastDate)
  end.setDate(end.getDate() + 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 52 * 7 - 1)
  while (start.getDay() !== 0) {
    start.setDate(start.getDate() - 1)
  }

  const weeks: { date: Date; key: string; commits: number }[][] = []
  const cur = new Date(start)
  let maxCommits = 0

  while (cur <= end) {
    const week: { date: Date; key: string; commits: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayData = dailyData.get(key)
      const commits = dayData?.commits || 0
      if (commits > maxCommits) maxCommits = commits
      week.push({ date: d, key, commits })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  const monthLabels: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, col) => {
    const m = week[0].date.getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ label: MONTH_NAMES[m], col })
      lastMonth = m
    }
  })

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex ml-7 mb-1 relative h-4">
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="text-[10px] text-zinc-500 absolute leading-4"
              style={{ left: `${m.col * 12 + 8}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="flex gap-[2px]">
          <div className="flex flex-col gap-[2px] mr-1">
            {['Mon', '', 'Wed', '', 'Fri', '', ''].map((label, i) => (
              <div key={i} className="h-[10px] text-[10px] text-zinc-500 leading-[10px] w-6">
                {label}
              </div>
            ))}
          </div>

          <div className="flex gap-[2px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day) => {
                  const intensity = getIntensity(day.commits, maxCommits)
                  return (
                    <div
                      key={day.key}
                      className={`w-[10px] h-[10px] rounded-[2px] ${INTENSITY_COLORS[intensity]} hover:ring-1 hover:ring-blue-300 transition-all`}
                      title={`${day.key}: ${Math.round(day.commits)} commits`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-3 ml-7 text-[10px] text-zinc-500">
          <span>Less</span>
          {INTENSITY_COLORS.map((c, i) => (
            <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
