import type { UserProfile } from '../types'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

function accountAge(createdAt: string): string {
  const created = new Date(createdAt)
  const now = new Date()
  const years = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  if (years >= 1) return `${years.toFixed(1)}y`
  const months = years * 12
  return `${Math.round(months)}mo`
}

function normalizeUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

export function ProfileCard({ profile }: { profile: UserProfile }) {
  const stats = [
    { label: 'Followers', value: formatNum(profile.followers) },
    { label: 'Following', value: formatNum(profile.following) },
    { label: 'Repos', value: formatNum(profile.publicRepos) },
    { label: 'Account age', value: accountAge(profile.createdAt) },
  ]

  return (
    <div className="flex items-start gap-4">
      <img
        src={profile.avatarUrl}
        alt={profile.login}
        className="w-12 h-12 rounded-full flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-medium text-zinc-100 truncate">
            {profile.name || profile.login}
          </h3>
          <a
            href={`https://github.com/${profile.login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
          >
            @{profile.login}
          </a>
        </div>
        {profile.bio && (
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{profile.bio}</p>
        )}
        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1">
              <span className="text-sm font-semibold text-zinc-100 tabular-nums">{s.value}</span>
              <span className="text-[10px] text-zinc-500">{s.label}</span>
            </div>
          ))}
          {profile.location && (
            <span className="text-[10px] text-zinc-500">{profile.location}</span>
          )}
          {profile.blog && (
            <a
              href={normalizeUrl(profile.blog)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[160px]"
            >
              {profile.blog}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
