# NCAA Swim & Dive Tracker — Full Feature Expansion Design

**Date:** 2026-03-03
**Status:** Approved

## Overview

Three parallel workstreams to expand the tracker:
1. **Quick wins** — fix 3 missing SC photos + build favorites drawer
2. **SwimCloud results pipeline** — scrape meets/results, surface in web app
3. **UI polish** — athlete best times, meet browser, team standings, home page improvements

---

## Section 1: Quick Wins

### A. Fix 3 Missing South Carolina Photos

Scrape `gamecocksonline.com/sports/mens-swimming-and-diving/roster/` for:
- Zachary Malek
- Josh McCall
- Tyler Hoard

Update `athletes` table `photo_url` for each. One Node.js script using the existing scraper pattern.

### B. Favorites Slide-Over Drawer

Replace the no-op favorites click handler in `Navigation.tsx` with a slide-over drawer (opens from the right). Two tabs:
- **Athletes** — grid of favorited athlete cards using existing `AthleteCard` component
- **Teams** — grid of favorited team cards using existing `TeamCard` component

Uses existing `useFavorites` hook. No new API routes needed.

---

## Section 2: SwimCloud Results Pipeline

### Data Architecture

**Bridge strategy:** Keep `athletes` + `teams` as the web app's primary tables. Query `swim_individual_results` by joining through `swim_athletes` on name + team slug at query time.

**Team slug mapping:** `teams.conference` values already use slugs (e.g. `"big-ten"`). Need a team slug map: `teams.name` → `swim_teams.id` (e.g. `"Texas A&M"` → `"texas-am"`).

### Scraper (Node.js + Playwright)

Location: `scripts/scrape-swimcloud-results.js`

Steps:
1. For each of 53 teams, fetch their SwimCloud team page to get 2024-25 season meets
2. For each meet, scrape all individual event result tables
3. Store:
   - Meet metadata → `swim_meets` (name, date, location, course type, SwimCloud meet ID)
   - Per-athlete results → `swim_individual_results` (athlete_id via swimcloud_id, event, final_time_ms, place, heat, lane)
4. Match athletes: look up `swim_athletes` by name + team_id to get their swimcloud_id

### Query Bridge (lib/swimcloud.ts)

```typescript
// Get best times for a web-app athlete
async function getAthleteBestTimes(name: string, teamSlug: string)
// Get recent meets for a team
async function getTeamMeets(teamSlug: string, limit?: number)
// Get full meet results
async function getMeetResults(meetId: number)
// Get team standings (ranked by dual meet wins or points)
async function getTeamStandings(conference?: string)
```

### New Routes

| Route | Component | Data source |
|---|---|---|
| `/meets` | `MeetsPage` | `swim_meets` — paginated, filterable by conference/date |
| `/meets/[id]` | `MeetDetailPage` | `swim_individual_results` — event tables with times/places |

### Modified Components

- **`app/athlete/[id]/page.tsx`** — add "Best Times" section + "Recent Meets" section below header
- **`components/Navigation.tsx`** — add "Meets" link to nav

---

## Section 3: UI Polish

### Athlete Detail Page Additions

Below the gradient header, add two new cards:

**Best Times card**
```
Event          | Best Time | Meet           | Date
200 Free       | 1:34.21   | SEC Champs     | Feb 2025
100 Free       | 44.83     | vs Florida     | Jan 2025
```
Shows "No results tracked yet" with a link to their official profile if empty.

**Recent Meets card**
Last 5 meets — meet name, date, their event(s), time(s), place(s).

### Home Page Improvements

1. **Live stat bar in hero** — "53 teams · 1,419 athletes · X meets tracked" — pulled from Supabase count queries
2. **Conference pill badges** — show team count on each filter pill (already computed in `filterCounts`, just needs display)
3. **Top Performers strip** — horizontal scroll strip on home page showing top 10 athletes in a selected event (100 Free default, user can switch). Each card shows athlete name, team, time.

### Meets Browser Page (`/meets`)

- List view: meet name, date, participating teams, course type
- Filter by conference, date range
- Click → full results page (`/meets/[id]`)

### Meet Detail Page (`/meets/[id]`)

- Header: meet name, date, location
- Event-by-event accordion: expand each event to see full results table
- Athlete names link to their profile page

---

## Implementation Order

1. Fix SC photos (30 min)
2. Favorites drawer (2 hrs)
3. SwimCloud scraper — build + run for all 53 teams (half day)
4. `lib/swimcloud.ts` query bridge (1 hr)
5. Athlete detail page best times + recent meets (2 hrs)
6. `/meets` + `/meets/[id]` pages (3 hrs)
7. Home page stat bar + top performers strip (2 hrs)
8. Conference pill badges (30 min)
