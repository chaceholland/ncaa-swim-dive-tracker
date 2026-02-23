# NCAA Swim & Dive Tracker — Features & UX Redesign

## Design Summary

**Audience:** Broad public — fans, coaches, recruits
**Priority:** Desktop-focused
**Goals:** Browse by team, find specific athletes, explore by conference

---

## New Pages

| Route | Description |
|-------|-------------|
| `/` | Redesigned home — hero search, conference pills, team grid, featured athletes strip |
| `/search?q=...` | Full search results — athletes (left, dominant) + teams (right sidebar) |
| `/athlete/[id]` | Athlete detail — full photo, team gradient header, stats, team roster strip |
| `/team/[id]` | Existing page — visual polish only |

---

## Section 1: Home Page

- **Hero** — headline, large centered search bar, 3 stat chips (teams, athletes, conferences)
- **Conference filter pills** — All, SEC, Big Ten, ACC, Big 12, Ivy, Patriot, Other
- **Team grid** — uniform cards with logo, name, conference badge, athlete count; hover shows team color gradient
- **Featured athletes strip** — horizontal scroll of 8–10 athlete cards (photo, name, team logo)

## Section 2: Global Search

- Search bar in nav, always visible
- Dropdown: 5 athlete results + 3 team results as you type (debounced)
- `/search` page: athletes column (left) + teams sidebar (right)
- Powered by Supabase `ilike` queries fired in parallel

## Section 3: Athlete Detail Page

- Full-width gradient header using team colors
- Large athlete photo + name, team logo, class year, hometown, athlete type badges
- "Official Profile" button if `profile_url` exists
- "More from [Team]" grid below (4 across, same card style)

## Section 4: Visual Polish

- Team page header refinement
- Athlete card redesign (larger photo area, cleaner info hierarchy)
- Skeleton loading states
- Consistent spacing/typography pass
