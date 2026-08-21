import type { LanguageStat } from '../types'

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`
  return `${bytes} B`
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Swift: '#F05138',
  Rust: '#dea584',
  Go: '#00ADD8',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Astro: '#ff5a03',
  Markdown: '#083fa1',
  JSON: '#292929',
  YAML: '#cb171e',
  Dockerfile: '#384d54',
  Ruby: '#701516',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  CSharp: '#178600',
  PHP: '#4F5D95',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Lua: '#000080',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  R: '#198CE7',
  Julia: '#a270ba',
  Zig: '#ec915c',
  Nim: '#ffc200',
  Perl: '#0298c3',
  SQL: '#e38c00',
  GraphQL: '#e10098',
  SCSS: '#c6538c',
  Sass: '#a53b70',
  Less: '#1d365d',
  WebAssembly: '#04133b',
  'Jupyter Notebook': '#DA5B0B',
}

function getColor(lang: string): string {
  return LANG_COLORS[lang] || '#71717a'
}

export function LanguageBreakdown({ languages }: { languages: LanguageStat[] }) {
  if (languages.length === 0) return null

  const top = languages.slice(0, 15)
  const otherBytes = languages.slice(15).reduce((s, l) => s + l.bytes, 0)
  const otherPct = languages.slice(15).reduce((s, l) => s + l.percentage, 0)
  const showOther = otherBytes > 0

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden">
        {top.map((l) => (
          <div
            key={l.language}
            style={{ width: `${l.percentage}%`, backgroundColor: getColor(l.language) }}
            title={`${l.language}: ${l.percentage.toFixed(1)}%`}
          />
        ))}
        {showOther && (
          <div
            style={{ width: `${otherPct}%`, backgroundColor: '#71717a' }}
            title={`Other: ${otherPct.toFixed(1)}%`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        {top.map((l) => (
          <div key={l.language} className="flex items-center gap-2 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-[2px] flex-shrink-0"
              style={{ backgroundColor: getColor(l.language) }}
            />
            <span className="text-zinc-300 truncate flex-1">{l.language}</span>
            <span className="text-zinc-500 font-mono tabular-nums">{l.percentage.toFixed(1)}%</span>
          </div>
        ))}
        {showOther && (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-[2px] flex-shrink-0 bg-zinc-500" />
            <span className="text-zinc-300 truncate flex-1">Other</span>
            <span className="text-zinc-500 font-mono tabular-nums">{otherPct.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-zinc-500">
        {formatBytes(languages.reduce((s, l) => s + l.bytes, 0))} across {languages.length} languages
      </p>
    </div>
  )
}
