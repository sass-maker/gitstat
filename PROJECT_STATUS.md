# gitstat

## Why / What

A GitHub analytics dashboard that shows a developer's public commit footprint across repos and orgs — totals, activity patterns, code churn, sampled AI agent involvement, and PR/issue activity. Enter any username to get stats; the earlier optional OAuth/private-repository connection is not currently exposed.

## Dependencies

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- Cloudflare Pages (functions + static deploy)
- GitHub REST API + GraphQL API
- No runtime dependencies beyond React

## Timeline

- 2026-08: Adopted as an active P2 secondary Fleet product with its live Pages
  surface and custom domain owned by GitStat
- 2026-08: Initial build — stats, heatmap, languages, churn, AI detection, patterns
- 2026-08: Two-tier access (public proxy + OAuth), GraphQL contribution calendar, commit quality
- 2026-08: Full data coverage — PRs, issues, starred repos, repo metadata, time patterns, collaboration, keywords, gap analysis
- 2026-08: Time-period filters (7D / 30D / 1Y / All), file/line-type exclusions, last-refresh timestamp, Taste tab removed

## Products

- **gitstat** — single-page web app, deployed to Cloudflare Pages

## Features (shipped)

### Data layer
- Repo discovery: personal + org repos, paginated
- Contributor stats: weekly additions/deletions/commits per repo (202 retry)
- Commit messages: fetched for AI detection + quality analysis (top 50 repos, 100 commits each)
- GraphQL contribution calendar: real daily counts (3 years, year-by-year)
- GraphQL contribution types: commits/PRs/issues/reviews/repos breakdown
- GraphQL PRs: state, merge time, size, changed files (100 most recent)
- GraphQL issues: state, resolution time, labels (100 most recent)
- Repo metadata: stars, forks, license, archived, language, description
- Languages: per-repo byte counts
- Retry/backoff: exponential with jitter, honors rate-limit headers, error classification
- Public mode: server-side token proxy (no OAuth required)
- Dev mode: Vite plugin proxy for local development

### Analytics
- Grand totals + per-org breakdown
- Monthly activity trends
- Real daily heatmap (GraphQL, falls back to weekly approximation)
- Summary stats: peak month, longest/current streak, avg/week, active days, first/last commit
- Language breakdown (byte-weighted)
- Code churn: gross/net per month, churn-per-commit, volatility, peak, trend, top repos
- AI agent detection: Co-Authored-By, Generated with, bot authors (Devin, Claude, Copilot, Cursor, etc.)
- AI timeline: monthly AI-assisted vs total
- Commit patterns: focus concentration (Gini), size distribution, repo activity, cadence
- Commit message quality: meaningful vs trivial (conventional prefix or 30+ chars)
- Time patterns: hour-of-day, day-of-week, night owl score, weekend warrior score
- Conventional commit breakdown: feat/fix/chore/docs/test/refactor/perf/style/ci/build/revert
- Collaboration: co-author network, pair ratio, top collaborators
- Commit keywords: top 30 words (stop-word filtered)
- Gap analysis: longest inactive period, top 5 gaps, total inactive days
- PR stats: merge rate, avg/median merge time, size distribution, monthly timeline, top repos
- Issue stats: close rate, avg/median resolution time, top labels, monthly timeline, top repos
- Repo metadata stats: total stars, forks, avg stars, fork ratio, archived, license distribution
- Time-period filtering: 7D / 30D / 1Y / All presets applied to all charts and totals
- File/line-type exclusions: glob-pattern exclusions (e.g. `package-lock.json`, `*.lock`) for generated files, subtracted from line-change metrics
- Last-refresh timestamp shown in the header

### UI (8 tabs)
- **Overview**: profile card, grand totals, contribution type chart, per-org table
- **Activity**: heatmap, monthly chart, summary stats, language breakdown, gap analysis
- **Churn**: gross/net chart, volatility, trend, top churn repos
- **AI**: AI-assisted %, tool breakdown, timeline, bot %, recent AI commits
- **Patterns**: focus, size distribution, repo activity, cadence, commit quality, time-of-day chart, day-of-week chart, conventional commits, collaboration, keyword cloud
- **PRs**: totals, merge rate, merge time, size distribution, timeline, top repos, recent PRs
- **Issues**: totals, close rate, resolution time, top labels, timeline, top repos, recent issues
- **Repos**: sortable table with stars, forks, language

## Work queue

[GitHub Issues](https://github.com/sass-maker/gitstat/issues)
