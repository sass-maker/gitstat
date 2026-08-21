import type { KeywordStats } from '../types'

export function KeywordCloud({ stats }: { stats: KeywordStats }) {
  const keywords = stats.topKeywords
  if (keywords.length === 0) return null

  const maxCount = Math.max(...keywords.map((k) => k.count), 1)
  const minCount = Math.min(...keywords.map((k) => k.count), 0)
  const range = maxCount - minCount || 1

  function fontSize(count: number): string {
    const ratio = (count - minCount) / range
    const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg']
    const idx = Math.min(Math.floor(ratio * sizes.length), sizes.length - 1)
    return sizes[idx]
  }

  function isFrequent(count: number): boolean {
    return count > minCount + range * 0.6
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2">
      {keywords.map((k) => (
        <span
          key={k.word}
          className={`${fontSize(k.count)} ${isFrequent(k.count) ? 'text-blue-400' : 'text-zinc-300'} font-medium leading-tight`}
        >
          {k.word}
          <span className="text-[10px] text-zinc-500 ml-0.5 tabular-nums">({k.count})</span>
        </span>
      ))}
    </div>
  )
}
