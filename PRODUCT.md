# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Open-source maintainers and contributors who want to see and showcase their
full commit footprint across all their GitHub repos and orgs. They are
motivated by understanding their own impact, sharing it publicly, and
comparing their cross-repo activity over time. Secondary audience: anyone
curious about a GitHub user's aggregate contribution footprint.

## Product Purpose

gitstat aggregates commits, lines added, and lines deleted across every repo
and org a GitHub user belongs to — then layers analytics on top: activity
heatmap, monthly trends, streaks, peak periods, and language breakdown.
GitHub's profile page shows contribution graphs but not aggregate line stats
or cross-org rollups. gitstat makes this a one-click operation for any
username.

## Positioning

Cross-repository GitHub analytics with enough depth to separate effort, churn,
collaboration, pull requests, issues, and sampled AI involvement instead of
collapsing work into one contribution count. Free, public, and no account
required for the current public-repository experience.

## Operating Context

- User enters any GitHub username; the current public experience does not expose OAuth.
- All data fetched client-side from the GitHub API; no server-side storage.
- Results cached in localStorage for 1 hour.
- Deployed on Cloudflare Pages with a thin Functions proxy for public GitHub requests.
- Dark, operational, dense UI — scannable tables and charts, not marketing.

## Capabilities and Constraints

- Public GitHub analysis through a shared proxy allowance; private repositories are not currently exposed.
- Repo discovery across personal account + all org memberships.
- Per-repo stats/contributors API with 202 retry handling.
- Aggregation: grand totals, per-org breakdown, per-repo breakdown.
- Analytics: monthly commit/lines chart, 52-week heatmap, summary stats
  (peak month, longest/current streak, avg/week, active days, most active
  day, first/last commit), language breakdown.
- Sortable per-repo table.
- localStorage caching with 1hr TTL and manual refresh.
- Rate limit display with reset countdown.
- Must remain free and public. The thin GitHub proxy does not store response
  data. No analytics tracking. No accounts.

## Brand Commitments

- Name: gitstat
- Voice: direct, technical, no marketing fluff
- Dark operational aesthetic consistent with fleet tooling
- No emoji unless explicitly requested

## Evidence on Hand

- Working CLI prototype that aggregated 15,530 commits across 175 repos for
  sarthakagrawal927, proving the data pipeline and API approach.
- GitHub stats/contributors API returns weekly breakdowns (timestamp,
  commits, additions, deletions) — sufficient for all planned analytics
  without extra endpoints except languages.

## Product Principles

1. Density over decoration — every pixel earns its place with data.
2. Any username, not just your own — the tool is for looking at anyone.
3. Analytics depth is the differentiator — go beyond counts into patterns.
4. Client-only — no server state, no tracking, no account, no paywall.
5. Fast to first insight — cache aggressively, stream partial results.
