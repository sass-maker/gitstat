import { useState } from 'react'
import type { FilterSettings } from '../lib/filters'
import { getExclusionPresets } from '../lib/filters'

interface ExclusionEditorProps {
  filters: FilterSettings
  onChange: (filters: FilterSettings) => void
}

export function ExclusionEditor({ filters, onChange }: ExclusionEditorProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')

  const addPattern = (pattern: string) => {
    const trimmed = pattern.trim()
    if (!trimmed || filters.exclusions.includes(trimmed)) return
    onChange({ ...filters, exclusions: [...filters.exclusions, trimmed] })
    setInput('')
  }

  const removePattern = (pattern: string) => {
    onChange({ ...filters, exclusions: filters.exclusions.filter((p) => p !== pattern) })
  }

  const applyPresets = () => {
    const presets = getExclusionPresets()
    const next = [...new Set([...filters.exclusions, ...presets])]
    onChange({ ...filters, exclusions: next })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          filters.exclusions.length > 0
            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
            : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
        }`}
        title="Exclude generated files from line-change metrics"
      >
        <span>Exclusions</span>
        {filters.exclusions.length > 0 && (
          <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full">
            {filters.exclusions.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 p-3">
          <p className="text-xs text-zinc-400 mb-2">
            Files matching these patterns are excluded from additions/deletions calculations.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPattern(input)}
              placeholder="e.g. package-lock.json"
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => addPattern(input)}
              disabled={!input.trim()}
              className="px-2 py-1 bg-blue-600 disabled:opacity-40 rounded text-xs text-white font-medium"
            >
              Add
            </button>
          </div>

          {filters.exclusions.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-xs text-zinc-500 mb-2">No exclusions set.</p>
              <button
                onClick={applyPresets}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Apply common generated-file presets
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-3">
              {filters.exclusions.map((pattern) => (
                <div
                  key={pattern}
                  className="flex items-center justify-between gap-2 px-2 py-1 bg-zinc-950 rounded text-xs"
                >
                  <code className="text-zinc-300 font-mono">{pattern}</code>
                  <button
                    onClick={() => removePattern(pattern)}
                    className="text-zinc-500 hover:text-rose-400"
                    aria-label={`Remove ${pattern}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <button
              onClick={applyPresets}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Apply presets
            </button>
            <button
              onClick={() => onChange({ ...filters, exclusions: [] })}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Clear all
            </button>
          </div>

          <p className="text-[10px] text-amber-400/80 mt-2">
            Warning: applying exclusions fetches per-commit file diffs and uses extra GitHub API calls.
          </p>
        </div>
      )}
    </div>
  )
}
