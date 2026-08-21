# Design

<!-- impeccable:design-schema 1 -->

## Direction

A developer commit portfolio dashboard. Repos are holdings, commits and lines
are performance metrics, orgs are sectors, languages are asset classes. The
category-default GitHub profile page (contribution squares + repo cards) is
refused in favor of dense tabular data with analytics depth.

## Mode

Operate. The visitor completes a task: understanding a GitHub user's full
commit footprint. Scanability, consistency, and data density outrank
expression.

## Color Strategy

Restrained. Deep neutral dark ground, one blue accent for primary actions and
selection, green/red reserved for additions/deletions (semantic, not
decorative). No drenched surfaces, no gradient text, no decorative color.

## Palette

- Ground: zinc-950 (#09090b)
- Surface: zinc-900 (#18181b)
- Border: zinc-800 (#27272a)
- Primary text: zinc-100 (#f4f4f5) — 15.25:1 contrast on ground
- Secondary text: zinc-400 (#a1a1a7) — 7.21:1 on ground
- Tertiary text: zinc-500 (#71717a) — 4.67:1 on ground (passes 4.5:1)
- Accent: blue-500 (#3b82f6) for primary actions, links, active tab
- Positive: emerald-500 (#10b981) for additions
- Negative: rose-500 (#f43f5e) for deletions
- Heatmap: blue scale (zinc-800 → blue-900 → blue-700 → blue-500 → blue-400)

## Typography

System sans stack. One family throughout — no display/body pairing.

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

- Fixed rem scale, not fluid. 1.125 ratio between steps.
- Monospace only for numerical data values and code, never for labels or
  navigation. Stack: `ui-monospace, 'SF Mono', Menlo, monospace`.
- Body measure: 65–75ch for prose, denser for tables (120ch+ fine).
- Tracking: -0.01em on headings, 0 on body, -0.02em on large numbers.

## Layout

- Max content width: 896px (max-w-4xl). Wider than 6xl causes sparse tables.
- Responsive: tables get horizontal scroll on mobile, charts reflow, heatmap
  scrolls horizontally.
- No sidebar. Top bar + content. Tabs for Overview / Analytics / Repos.
- Spacing: 8px base unit. Tight groups, generous separation between sections.
  More space above a heading than below it.

## Components

- **Inline figures** for grand totals, not cards. Numbers live in a summary
  bar with labels, not in boxed stat cards.
- **Tables** are the primary data structure. Right-aligned numbers, left-
  aligned text, hairline row borders, hover highlight.
- **Charts** are minimal: CSS bar charts from divs, heatmap from grid cells.
  No chart library, no SVG paths, no canvas.
- **Tabs** are underline-style, not pill buttons. Active tab has a 2px bottom
  border in accent color.
- **Buttons**: solid blue for primary, ghost (border only) for secondary.
  Same shape, same radius (6px), same padding vocabulary everywhere.
- **Inputs**: dark surface, zinc-700 border, blue-500 focus border. No glow.

## States

Every interactive component has: default, hover, focus-visible, active,
disabled, loading. Skeleton states for data loading, not spinners.

## Motion

150–200ms transitions. Motion conveys state only: tab switch, button press,
progress bar fill. No orchestrated page-load sequences. No decorative
animation.

## Refused

- Same-size stat cards as page structure
- Tracked uppercase eyebrows over every section
- Monospace as costume for "technical" feel
- Gradient text, glass effects, decorative blur
- Colored border-left/right on cards or rows
- Sparklines and progress rings standing in for content
- Modal as first thought for any task
