# Full Feature Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SwimCloud meet results pipeline, favorites drawer, athlete best times/meet pages, and home page polish to the NCAA Swim & Dive Tracker.

**Architecture:** The web app uses `athletes` + `teams` tables (Supabase). SwimCloud results live in `swim_individual_results` + `swim_meets` + `swim_athletes` tables (same Supabase project). We bridge them by matching `swim_athletes.name` + `swim_athletes.team_id` (slug) against web app athlete name + team slug at query time. No schema changes needed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS 4, Framer Motion, Supabase (PostgreSQL), Node.js + Playwright (scraper), Vercel

---

## Task 1: Fix 3 Missing South Carolina Photos

**Files:**
- Create: `scripts/fix-sc-missing-photos.js`

**Context:**
Three athletes in South Carolina are missing `photo_url`:
- Zachary Malek
- Josh McCall
- Tyler Hoard

South Carolina uses SIDEARM. Their roster URL: `https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/`

**Step 1: Create the script**

```javascript
// scripts/fix-sc-missing-photos.js
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGETS = ['Zachary Malek', 'Josh McCall', 'Tyler Hoard'];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  // SIDEARM pattern: .s-person-card or .sidearm-roster-player
  const athletes = await page.evaluate(() => {
    const results = [];
    // Try new SIDEARM card style
    document.querySelectorAll('.s-person-card').forEach(card => {
      const name = card.querySelector('.s-person-details__personal-title')?.textContent?.trim();
      const img = card.querySelector('img.s-person-card__figure__image, img[data-src], img[src]');
      let photo = img?.getAttribute('data-src') || img?.getAttribute('src') || null;
      if (photo && photo.startsWith('/')) photo = 'https://gamecocksonline.com' + photo;
      if (name && photo && !photo.includes('silhouette') && !photo.includes('placeholder')) {
        results.push({ name, photo });
      }
    });
    // Fallback: legacy SIDEARM roster
    if (results.length === 0) {
      document.querySelectorAll('.sidearm-roster-player').forEach(card => {
        const name = card.querySelector('.sidearm-roster-player-name a')?.textContent?.trim();
        const img = card.querySelector('img');
        let photo = img?.getAttribute('data-src') || img?.getAttribute('src') || null;
        if (photo && photo.startsWith('/')) photo = 'https://gamecocksonline.com' + photo;
        if (name && photo && !photo.includes('silhouette')) {
          results.push({ name, photo });
        }
      });
    }
    return results;
  });

  console.log(`Found ${athletes.length} athletes on roster page`);

  for (const target of TARGETS) {
    const match = athletes.find(a =>
      a.name.toLowerCase().includes(target.toLowerCase().split(' ')[1]) &&
      a.name.toLowerCase().includes(target.toLowerCase().split(' ')[0])
    );

    if (!match) {
      console.log(`  ✗ No match found for ${target}`);
      continue;
    }

    console.log(`  ✓ ${target} → ${match.photo}`);

    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: match.photo })
      .ilike('name', `%${target.split(' ')[1]}%`)
      .eq('team_id', (
        await supabase.from('teams').select('id').ilike('name', '%South Carolina%').single()
      ).data?.id);

    if (error) console.error(`  Error updating ${target}:`, error);
    else console.log(`  ✓ Updated ${target} in database`);
  }

  await browser.close();
}

run().catch(console.error);
```

**Step 2: Run the script**

```bash
cd /Users/chace/Desktop/ncaa-swim-dive-tracker
node --env-file=.env.local scripts/fix-sc-missing-photos.js
```

Expected: 3 athletes found and updated. If photo URL includes "silhouette", the scraper needs adjustment.

**Step 3: Verify in database**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('athletes').select('name, photo_url').ilike('name', '%Malek%').then(r => console.log(r.data));
"
```

**Step 4: Commit**

```bash
git add scripts/fix-sc-missing-photos.js
git commit -m "fix: add missing South Carolina athlete photos (Malek, McCall, Hoard)"
```

---

## Task 2: Favorites Slide-Over Drawer

**Files:**
- Create: `components/FavoritesDrawer.tsx`
- Modify: `app/page.tsx` (wire drawer state)

**Context:**
`useFavorites` from `@/lib/hooks/useFavorites` returns `athleteFavorites: AthleteFavorite[]` and `teamFavorites: TeamFavorite[]`. The hook already loads from Supabase `csd_anon_favorites` / `csd_anon_team_favorites`.

In `app/page.tsx`, `handleFavoritesClick` currently does `console.log(...)`. We replace it with state that opens the drawer.

**Step 1: Create `FavoritesDrawer.tsx`**

```tsx
// components/FavoritesDrawer.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { isExternalUrl } from '@/lib/image-utils';
import type { AthleteFavorite, TeamFavorite } from '@/lib/hooks/useFavorites';

type Tab = 'athletes' | 'teams';

interface FavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  athletes: AthleteFavorite[];
  teams: TeamFavorite[];
  onRemoveAthlete: (id: string) => void;
  onRemoveTeam: (id: string) => void;
}

export default function FavoritesDrawer({
  isOpen,
  onClose,
  athletes,
  teams,
  onRemoveAthlete,
  onRemoveTeam,
}: FavoritesDrawerProps) {
  const [tab, setTab] = useState<Tab>('athletes');

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Favorites</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
                aria-label="Close favorites"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              {(['athletes', 'teams'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
                    tab === t
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'athletes' ? `Athletes (${athletes.length})` : `Teams (${teams.length})`}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'athletes' && (
                <div className="space-y-3">
                  {athletes.length === 0 ? (
                    <EmptyState type="athletes" />
                  ) : (
                    athletes.map((athlete) => (
                      <AthleteRow
                        key={athlete.id}
                        athlete={athlete}
                        onRemove={() => onRemoveAthlete(athlete.id)}
                      />
                    ))
                  )}
                </div>
              )}
              {tab === 'teams' && (
                <div className="space-y-3">
                  {teams.length === 0 ? (
                    <EmptyState type="teams" />
                  ) : (
                    teams.map((team) => (
                      <TeamRow
                        key={team.id}
                        team={team}
                        onRemove={() => onRemoveTeam(team.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function AthleteRow({ athlete, onRemove }: { athlete: AthleteFavorite; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
      <Link href={`/athlete/${athlete.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
          {athlete.photo_url ? (
            isExternalUrl(athlete.photo_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={athlete.photo_url} alt={athlete.name} referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={athlete.photo_url} alt={athlete.name}
                className="w-full h-full object-cover object-top" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">
              {athlete.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{athlete.name}</p>
          <p className="text-xs text-slate-500 capitalize">
            {athlete.class_year} · {athlete.athlete_type}
          </p>
        </div>
      </Link>
      <button
        onClick={onRemove}
        className="p-2 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
        aria-label="Remove from favorites"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function TeamRow({ team, onRemove }: { team: TeamFavorite; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
      <Link href={`/team/${team.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center flex-shrink-0">
          {team.logo_url ? (
            isExternalUrl(team.logo_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo_url} alt={team.name} referrerPolicy="no-referrer"
                className="w-full h-full object-contain p-1" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo_url} alt={team.name}
                className="w-full h-full object-contain p-1" />
            )
          ) : (
            <span className="text-slate-600 font-bold text-sm">{team.name.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{team.name}</p>
          <p className="text-xs text-slate-500">{team.conference}</p>
        </div>
      </Link>
      <button
        onClick={onRemove}
        className="p-2 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
        aria-label="Remove from favorites"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function EmptyState({ type }: { type: 'athletes' | 'teams' }) {
  return (
    <div className="text-center py-12">
      <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      <p className="text-slate-500 text-sm">No favorite {type} yet.</p>
      <p className="text-slate-400 text-xs mt-1">
        Click the ♥ on any {type === 'athletes' ? 'athlete card' : 'team'} to save it here.
      </p>
    </div>
  );
}
```

**Step 2: Wire drawer into `app/page.tsx`**

Add these changes to `app/page.tsx`:

```tsx
// Add import at top
import FavoritesDrawer from '@/components/FavoritesDrawer';

// In the Home component, replace:
//   const [showIssuesModal, setShowIssuesModal] = useState(false);
// with:
const [showIssuesModal, setShowIssuesModal] = useState(false);
const [showFavoritesDrawer, setShowFavoritesDrawer] = useState(false);

// Replace handleFavoritesClick:
const handleFavoritesClick = () => {
  setShowFavoritesDrawer(true);
};

// Add FavoritesDrawer before the closing </main> tag:
<FavoritesDrawer
  isOpen={showFavoritesDrawer}
  onClose={() => setShowFavoritesDrawer(false)}
  athletes={teamFavorites.map(() => ({} as any))} // replaced next step
  teams={teamFavorites}
  onRemoveAthlete={removeAthleteFavorite}
  onRemoveTeam={removeTeamFavorite}
/>
```

Wait — the `useFavorites` hook returns `athleteFavorites` and `teamFavorites`. Destructure them properly:

```tsx
// In Home(), expand useFavorites destructuring to include:
const {
  athleteFavorites,     // add this
  teamFavorites,
  toggleTeamFavorite,
  isTeamFavorite,
  totalCount: favoritesCount,
  removeAthleteFavorite,  // add this
  removeTeamFavorite,     // add this
} = useFavorites();
```

Then pass to drawer:
```tsx
<FavoritesDrawer
  isOpen={showFavoritesDrawer}
  onClose={() => setShowFavoritesDrawer(false)}
  athletes={athleteFavorites}
  teams={teamFavorites}
  onRemoveAthlete={removeAthleteFavorite}
  onRemoveTeam={removeTeamFavorite}
/>
```

**Step 3: Build and verify**

```bash
npm run build
```

Expected: No TypeScript errors. Open http://localhost:3000, click Favorites button → drawer slides in from right with Athletes/Teams tabs.

**Step 4: Commit**

```bash
git add components/FavoritesDrawer.tsx app/page.tsx
git commit -m "feat: add favorites slide-over drawer with athlete and team tabs"
```

---

## Task 3: SwimCloud Scraper — Populate Meet Results

**Files:**
- Create: `scripts/scrape-swimcloud-season.js`

**Context:**
SwimCloud team pages follow pattern: `https://www.swimcloud.com/team/{swimcloud_team_id}/meets/?season=25`

The `swim_athletes` table has a `swimcloud_id` column (currently null for all). We need to:
1. Find each team's SwimCloud team page
2. Get their 2024-25 season meets
3. For each meet, scrape individual event results
4. Upsert into `swim_meets` and `swim_individual_results`

The `swim_athletes.team_id` slugs match `swim_teams.id` (e.g. "ohio-state", "south-carolina").

**Step 1: Create team → SwimCloud ID mapping script**

```javascript
// scripts/find-swimcloud-team-ids.js
// This script searches SwimCloud for each team's ID
// Run once to build the mapping

import { chromium } from 'playwright';

const TEAMS = [
  'Alabama', 'Arizona', 'Arizona State', 'Auburn', 'Brown', 'Cal',
  'California', 'Columbia', 'Cornell', 'Dartmouth', 'Duke', 'Florida',
  'Florida State', 'Georgia', 'Georgia Tech', 'Harvard', 'Indiana',
  'Iowa', 'Kentucky', 'Louisville', 'LSU', 'Michigan', 'Minnesota',
  'Missouri', 'Navy', 'NC State', 'North Carolina', 'Northwestern',
  'Notre Dame', 'Ohio State', 'Penn', 'Penn State', 'Princeton',
  'Purdue', 'SMU', 'South Carolina', 'Stanford', 'TCU', 'Tennessee',
  'Texas', 'Texas A&M', 'Towson', 'UCLA', 'UNC', 'UNLV', 'USC',
  'Utah', 'Vanderbilt', 'Virginia', 'Virginia Tech', 'West Virginia',
  'Wisconsin', 'Yale'
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const mapping = {};

  for (const team of TEAMS) {
    try {
      const searchUrl = `https://www.swimcloud.com/teams/?q=${encodeURIComponent(team + ' NCAA')}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });

      const results = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/team/"]')).slice(0, 3).map(a => ({
          name: a.textContent?.trim(),
          href: a.getAttribute('href'),
        }));
      });

      // Find best match
      const match = results.find(r =>
        r.name?.toLowerCase().includes(team.toLowerCase().split(' ')[0])
      );
      if (match) {
        const idMatch = match.href?.match(/\/team\/(\d+)\//);
        if (idMatch) {
          mapping[team] = idMatch[1];
          console.log(`✓ ${team} → ${idMatch[1]}`);
        }
      } else {
        console.log(`✗ ${team} → not found`);
      }

      await new Promise(r => setTimeout(r, 1000)); // be polite
    } catch (e) {
      console.log(`✗ ${team} → error: ${e.message}`);
    }
  }

  await browser.close();
  console.log('\n// Team ID mapping:');
  console.log(JSON.stringify(mapping, null, 2));
}

run().catch(console.error);
```

**Step 2: Run and capture team IDs**

```bash
node scripts/find-swimcloud-team-ids.js 2>&1 | tee scripts/swimcloud-team-ids.json
```

**Step 3: Create meet results scraper**

```javascript
// scripts/scrape-swimcloud-season.js
// Scrapes 2024-25 season meets for all teams and stores results in Supabase

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import TEAM_IDS from './swimcloud-team-ids.json' assert { type: 'json' };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTeamMeets(page, swimcloudTeamId) {
  const url = `https://www.swimcloud.com/team/${swimcloudTeamId}/meets/?season=25`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/results/"]')).map(a => ({
      name: a.textContent?.trim(),
      url: 'https://www.swimcloud.com' + a.getAttribute('href'),
      id: a.getAttribute('href')?.match(/\/results\/(\d+)\//)?.[1],
    })).filter(m => m.id);
  });
}

async function scrapeMeetResults(page, meet) {
  await page.goto(meet.url, { waitUntil: 'networkidle', timeout: 30000 });

  // Get meet metadata
  const metadata = await page.evaluate(() => {
    const dateEl = document.querySelector('[class*="date"], time');
    const locationEl = document.querySelector('[class*="location"], [class*="venue"]');
    return {
      date: dateEl?.textContent?.trim(),
      location: locationEl?.textContent?.trim(),
    };
  });

  // Get all event links on this meet page
  const eventLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/event/"]')).map(a => ({
      name: a.textContent?.trim(),
      url: 'https://www.swimcloud.com' + a.getAttribute('href'),
      eventId: a.getAttribute('href')?.match(/\/event\/([^/]+)\//)?.[1],
    })).filter(e => e.eventId);
  });

  const results = [];

  for (const event of eventLinks.slice(0, 30)) { // cap at 30 events per meet
    try {
      await page.goto(event.url, { waitUntil: 'networkidle', timeout: 15000 });

      const rows = await page.evaluate(() => {
        const tableRows = [];
        document.querySelectorAll('tbody tr').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim());
          const nameLink = tr.querySelector('a[href*="/swimmer/"]');
          const swimcloudId = nameLink?.getAttribute('href')?.match(/\/swimmer\/(\d+)\//)?.[1];

          if (cells.length >= 3 && swimcloudId) {
            tableRows.push({
              swimcloudAthleteId: swimcloudId,
              name: nameLink?.textContent?.trim(),
              place: parseInt(cells[0]) || null,
              time: cells.find(c => /\d+:\d+\.\d+|\d+\.\d+/.test(c)) || null,
              teamName: tr.querySelector('[class*="team"]')?.textContent?.trim(),
            });
          }
        });
        return tableRows;
      });

      results.push(...rows.map(r => ({ ...r, eventName: event.name, eventId: event.eventId })));
      await new Promise(res => setTimeout(res, 500));
    } catch (e) {
      console.log(`    Skipped event ${event.name}: ${e.message}`);
    }
  }

  return { metadata, results };
}

function parseTimeToMs(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.replace(/[^0-9:.]/g, '').split(':');
  if (parts.length === 2) {
    return (parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 1000;
  }
  return parseFloat(parts[0]) * 1000;
}

async function upsertMeet(meet, metadata) {
  const { data, error } = await supabase
    .from('swim_meets')
    .upsert({
      name: meet.name,
      url: meet.url,
      season: '2024-25',
      course_type: 'SCY',
      location: metadata.location,
    }, { onConflict: 'url' })
    .select('id')
    .single();

  if (error) {
    console.error('Error upserting meet:', error);
    return null;
  }
  return data.id;
}

async function upsertResults(meetId, results) {
  const rows = results
    .filter(r => r.swimcloudAthleteId && r.time)
    .map(r => ({
      meet_id: String(meetId),
      event_id: r.eventId,
      athlete_id: r.swimcloudAthleteId,
      final_time_ms: parseTimeToMs(r.time),
      final_place: r.place,
      course: 'SCY',
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('swim_individual_results')
    .upsert(rows, { onConflict: 'meet_id,event_id,athlete_id' });

  if (error) console.error('Error upserting results:', error.message);
  else console.log(`    Stored ${rows.length} results`);
}

// Also update swim_athletes with swimcloud_id when we see athletes
async function updateSwimcloudIds(results) {
  const seen = new Map();
  for (const r of results) {
    if (r.swimcloudAthleteId && r.name && !seen.has(r.swimcloudAthleteId)) {
      seen.set(r.swimcloudAthleteId, r.name);
    }
  }

  for (const [swimcloudId, name] of seen) {
    await supabase
      .from('swim_athletes')
      .update({ swimcloud_id: swimcloudId })
      .ilike('name', `%${name.split(' ').slice(-1)[0]}%`)
      .is('swimcloud_id', null);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalMeets = 0, totalResults = 0;

  for (const [teamName, swimcloudTeamId] of Object.entries(TEAM_IDS)) {
    console.log(`\nProcessing ${teamName} (ID: ${swimcloudTeamId})`);

    try {
      const meets = await getTeamMeets(page, swimcloudTeamId);
      console.log(`  Found ${meets.length} meets`);

      for (const meet of meets) {
        console.log(`  Scraping: ${meet.name}`);
        const { metadata, results } = await scrapeMeetResults(page, meet);
        const meetId = await upsertMeet(meet, metadata);
        if (meetId) {
          await upsertResults(meetId, results);
          await updateSwimcloudIds(results);
          totalResults += results.length;
          totalMeets++;
        }
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\nDone: ${totalMeets} meets, ${totalResults} results`);
}

run().catch(console.error);
```

**Step 4: Install playwright if needed and run**

```bash
npx playwright install chromium
node --env-file=.env.local scripts/scrape-swimcloud-season.js
```

Expected: ~100+ meets, thousands of results populated. Takes 30-60 min.

**Step 5: Verify data populated**

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
Promise.all([
  sb.from('swim_meets').select('id', { count: 'exact', head: true }),
  sb.from('swim_individual_results').select('id', { count: 'exact', head: true }),
]).then(([m, r]) => console.log('Meets:', m.count, 'Results:', r.count));
"
```

**Step 6: Commit scripts**

```bash
git add scripts/find-swimcloud-team-ids.js scripts/scrape-swimcloud-season.js
git commit -m "feat: add SwimCloud season scraper for meets and individual results"
```

---

## Task 4: SwimCloud Query Bridge (`lib/swimcloud.ts`)

**Files:**
- Create: `lib/swimcloud.ts`
- Modify: `lib/supabase/types.ts` (add result types)

**Context:**
This module bridges the web app's `athletes` table to `swim_*` result tables using name + team slug matching. The team slug in `swim_athletes.team_id` is lowercase hyphenated (e.g. "ohio-state"). The `teams.name` in our web app is proper-cased (e.g. "Ohio State").

**Step 1: Add types to `lib/supabase/types.ts`**

Append to the file:

```typescript
export interface SwimMeet {
  id: number;
  name: string;
  url: string;
  season: string;
  date_start: string | null;
  date_end: string | null;
  location: string | null;
  course_type: string;
}

export interface SwimResult {
  id: number;
  meet_id: string;
  event_id: string;
  athlete_id: string;
  final_time_ms: number | null;
  final_place: number | null;
  course: string;
  meet?: SwimMeet;
}

export interface AthleteBestTime {
  eventId: string;
  eventName: string;
  timeMs: number;
  timeFormatted: string;
  place: number | null;
  meetName: string;
  meetDate: string | null;
  meetId: number;
}
```

**Step 2: Create `lib/swimcloud.ts`**

```typescript
// lib/swimcloud.ts
// Bridge between web app athletes and SwimCloud result tables.
// Matching strategy: join swim_athletes on name similarity + team slug.

import { supabase } from '@/lib/supabase/client';
import type { AthleteBestTime, SwimMeet, SwimResult } from '@/lib/supabase/types';

/** Convert a team name like "Ohio State" to a slug like "ohio-state" */
export function teamNameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Format milliseconds as swim time string: 93400 → "1:33.40", 45200 → "45.20" */
export function formatSwimTime(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds >= 60) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(2).padStart(5, '0');
    return `${mins}:${secs}`;
  }
  return totalSeconds.toFixed(2);
}

/**
 * Get best times for a web-app athlete by name + team slug.
 * Returns one entry per event (the personal best).
 */
export async function getAthleteBestTimes(
  athleteName: string,
  teamName: string
): Promise<AthleteBestTime[]> {
  const teamSlug = teamNameToSlug(teamName);

  // Find the swim_athlete record by name + team
  const { data: swimAthlete } = await supabase
    .from('swim_athletes')
    .select('id, swimcloud_id')
    .eq('team_id', teamSlug)
    .ilike('name', `%${athleteName.split(' ').slice(-1)[0]}%`) // last name match
    .limit(1)
    .single();

  if (!swimAthlete?.swimcloud_id) return [];

  // Get all results for this swimcloud athlete ID
  const { data: results } = await supabase
    .from('swim_individual_results')
    .select('event_id, final_time_ms, final_place, meet_id, course')
    .eq('athlete_id', swimAthlete.swimcloud_id)
    .not('final_time_ms', 'is', null)
    .order('final_time_ms', { ascending: true });

  if (!results || results.length === 0) return [];

  // Group by event and keep best time
  const bestByEvent = new Map<string, (typeof results)[0]>();
  for (const r of results) {
    if (!bestByEvent.has(r.event_id) || (r.final_time_ms ?? Infinity) < (bestByEvent.get(r.event_id)!.final_time_ms ?? Infinity)) {
      bestByEvent.set(r.event_id, r);
    }
  }

  // Fetch meet names for display
  const meetIds = [...new Set([...bestByEvent.values()].map(r => r.meet_id))];
  const { data: meets } = await supabase
    .from('swim_meets')
    .select('id, name, date_start')
    .in('id', meetIds.map(Number));

  const meetMap = new Map(meets?.map(m => [String(m.id), m]) ?? []);

  return [...bestByEvent.entries()].map(([eventId, r]) => {
    const meet = meetMap.get(r.meet_id);
    return {
      eventId,
      eventName: formatEventName(eventId),
      timeMs: r.final_time_ms!,
      timeFormatted: formatSwimTime(r.final_time_ms!),
      place: r.final_place,
      meetName: meet?.name ?? 'Unknown Meet',
      meetDate: meet?.date_start ?? null,
      meetId: Number(r.meet_id),
    };
  }).sort((a, b) => a.eventId.localeCompare(b.eventId));
}

/**
 * Get recent meets an athlete competed in.
 */
export async function getAthleteRecentMeets(
  athleteName: string,
  teamName: string,
  limit = 5
): Promise<(SwimMeet & { events: string[]; times: string[] })[]> {
  const teamSlug = teamNameToSlug(teamName);

  const { data: swimAthlete } = await supabase
    .from('swim_athletes')
    .select('swimcloud_id')
    .eq('team_id', teamSlug)
    .ilike('name', `%${athleteName.split(' ').slice(-1)[0]}%`)
    .limit(1)
    .single();

  if (!swimAthlete?.swimcloud_id) return [];

  const { data: results } = await supabase
    .from('swim_individual_results')
    .select('meet_id, event_id, final_time_ms')
    .eq('athlete_id', swimAthlete.swimcloud_id)
    .not('final_time_ms', 'is', null);

  if (!results || results.length === 0) return [];

  // Group by meet
  const byMeet = new Map<string, { events: string[]; times: string[] }>();
  for (const r of results) {
    if (!byMeet.has(r.meet_id)) byMeet.set(r.meet_id, { events: [], times: [] });
    byMeet.get(r.meet_id)!.events.push(formatEventName(r.event_id));
    byMeet.get(r.meet_id)!.times.push(formatSwimTime(r.final_time_ms!));
  }

  const meetIds = [...byMeet.keys()].slice(0, limit * 2);
  const { data: meets } = await supabase
    .from('swim_meets')
    .select('*')
    .in('id', meetIds.map(Number))
    .order('date_start', { ascending: false })
    .limit(limit);

  return (meets ?? []).map(m => ({
    ...m,
    ...byMeet.get(String(m.id)) ?? { events: [], times: [] },
  }));
}

/**
 * Get all meets for the current season, optionally filtered by conference.
 */
export async function getAllMeets(options?: { conference?: string; limit?: number }): Promise<SwimMeet[]> {
  let query = supabase
    .from('swim_meets')
    .select('*')
    .eq('season', '2024-25')
    .order('date_start', { ascending: false });

  if (options?.limit) query = query.limit(options.limit);

  const { data } = await query;
  return data ?? [];
}

/**
 * Get full results for a single meet (all events, all athletes).
 */
export async function getMeetResults(meetId: number): Promise<{
  meet: SwimMeet;
  events: { eventId: string; eventName: string; results: { athleteName: string; teamSlug: string; timeFormatted: string; place: number | null }[] }[];
}> {
  const [{ data: meet }, { data: results }] = await Promise.all([
    supabase.from('swim_meets').select('*').eq('id', meetId).single(),
    supabase.from('swim_individual_results')
      .select('event_id, athlete_id, final_time_ms, final_place')
      .eq('meet_id', String(meetId))
      .not('final_time_ms', 'is', null)
      .order('event_id')
      .order('final_time_ms'),
  ]);

  if (!meet || !results) return { meet: meet!, events: [] };

  // Fetch athlete names
  const athleteIds = [...new Set(results.map(r => r.athlete_id))];
  const { data: athletes } = await supabase
    .from('swim_athletes')
    .select('swimcloud_id, name, team_id')
    .in('swimcloud_id', athleteIds);

  const athleteMap = new Map(athletes?.map(a => [a.swimcloud_id, a]) ?? []);

  // Group by event
  const byEvent = new Map<string, typeof events[0]['results']>();
  for (const r of results) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    const athlete = athleteMap.get(r.athlete_id);
    byEvent.get(r.event_id)!.push({
      athleteName: athlete?.name ?? 'Unknown',
      teamSlug: athlete?.team_id ?? '',
      timeFormatted: formatSwimTime(r.final_time_ms!),
      place: r.final_place,
    });
  }

  const events = [...byEvent.entries()].map(([eventId, results]) => ({
    eventId,
    eventName: formatEventName(eventId),
    results,
  }));

  return { meet, events };
}

/** Convert SwimCloud event ID to readable name */
function formatEventName(eventId: string): string {
  // SwimCloud event IDs look like "200M" (200 meter), "100Y" (100 yard), etc.
  // Or "200FR" (200 Free), "100FLY" (100 Fly), etc.
  const map: Record<string, string> = {
    '50FR': '50 Free', '100FR': '100 Free', '200FR': '200 Free',
    '500FR': '500 Free', '1000FR': '1000 Free', '1650FR': '1650 Free',
    '100BK': '100 Back', '200BK': '200 Back',
    '100BR': '100 Breast', '200BR': '200 Breast',
    '100FLY': '100 Fly', '200FLY': '200 Fly',
    '200IM': '200 IM', '400IM': '400 IM',
    '200MR': '200 Medley Relay', '400MR': '400 Medley Relay',
    '200FR-R': '200 Free Relay', '400FR-R': '400 Free Relay', '800FR-R': '800 Free Relay',
  };
  return map[eventId] ?? eventId;
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add lib/swimcloud.ts lib/supabase/types.ts
git commit -m "feat: add SwimCloud query bridge with best times and meet results helpers"
```

---

## Task 5: Athlete Detail Page — Best Times and Recent Meets

**Files:**
- Modify: `app/athlete/[id]/page.tsx`

**Context:**
The page already loads `athlete` and `team` from Supabase. Add two sections below the existing header: a "Best Times" table and a "Recent Meets" list. Both use the `swimcloud.ts` bridge.

**Step 1: Add state and data fetching to `AthletePage`**

In `app/athlete/[id]/page.tsx`, add to imports:
```typescript
import { getAthleteBestTimes, getAthleteRecentMeets } from '@/lib/swimcloud';
import type { AthleteBestTime } from '@/lib/supabase/types';
```

Add state inside `AthletePage`:
```typescript
const [bestTimes, setBestTimes] = useState<AthleteBestTime[]>([]);
const [recentMeets, setRecentMeets] = useState<any[]>([]);
const [resultsLoading, setResultsLoading] = useState(false);
```

Inside the `load()` function in `useEffect`, after `setTeam(teamData)`:
```typescript
if (teamData && athleteData) {
  setResultsLoading(true);
  const [times, meets] = await Promise.all([
    getAthleteBestTimes(athleteData.name, teamData.name),
    getAthleteRecentMeets(athleteData.name, teamData.name),
  ]);
  setBestTimes(times);
  setRecentMeets(meets);
  setResultsLoading(false);
}
```

**Step 2: Add Best Times section to the JSX**

After the closing `</div>` of the gradient header block, before the teammates section:

```tsx
{/* Best Times & Recent Meets */}
<div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Best Times Card */}
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100">
      <h2 className="text-lg font-bold text-slate-900">Best Times</h2>
    </div>
    <div className="p-4">
      {resultsLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : bestTimes.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No tracked times yet.</p>
          {athlete.profile_url && (
            <a href={athlete.profile_url} target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm mt-2 inline-block">
              View official profile →
            </a>
          )}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
              <th className="pb-2 font-semibold">Event</th>
              <th className="pb-2 font-semibold text-right">Time</th>
              <th className="pb-2 font-semibold text-right pr-0">Meet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bestTimes.map((bt) => (
              <tr key={bt.eventId} className="hover:bg-slate-50">
                <td className="py-2.5 font-medium text-slate-800">{bt.eventName}</td>
                <td className="py-2.5 text-right font-mono font-semibold text-blue-700">
                  {bt.timeFormatted}
                </td>
                <td className="py-2.5 text-right text-slate-500 text-xs truncate max-w-[120px]">
                  {bt.meetName.length > 20 ? bt.meetName.slice(0, 18) + '…' : bt.meetName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>

  {/* Recent Meets Card */}
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100">
      <h2 className="text-lg font-bold text-slate-900">Recent Meets</h2>
    </div>
    <div className="p-4">
      {resultsLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : recentMeets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No meet history tracked.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentMeets.map((meet) => (
            <div key={meet.id} className="p-3 bg-slate-50 rounded-xl">
              <p className="font-semibold text-slate-800 text-sm truncate">{meet.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {meet.date_start ? new Date(meet.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unknown'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {meet.events.slice(0, 4).map((event: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700">
                    {event}
                    <span className="text-blue-600 font-mono font-medium">{meet.times[i]}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
</div>
```

**Step 3: Build and verify**

```bash
npm run build
```

Open an athlete page that has swimcloud data. Best times and meet cards should render (or gracefully show "No tracked times yet" if results aren't populated yet).

**Step 4: Commit**

```bash
git add app/athlete/\[id\]/page.tsx
git commit -m "feat: add best times and recent meets sections to athlete detail page"
```

---

## Task 6: Meets Browser (`/meets` and `/meets/[id]`)

**Files:**
- Create: `app/meets/page.tsx`
- Create: `app/meets/[id]/page.tsx`

**Step 1: Create `/meets` page**

```tsx
// app/meets/page.tsx
import { getAllMeets } from '@/lib/swimcloud';
import Link from 'next/link';
import Navigation from '@/components/Navigation';

export const revalidate = 3600; // revalidate every hour

export default async function MeetsPage() {
  const meets = await getAllMeets({ limit: 100 });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            ← All Teams
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4">Meet Results</h1>
          <p className="text-slate-600 mt-1">2024-25 Season · {meets.length} meets tracked</p>
        </div>

        <div className="space-y-3">
          {meets.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500 text-lg">No meets scraped yet.</p>
              <p className="text-slate-400 text-sm mt-1">Run the SwimCloud scraper to populate meet results.</p>
            </div>
          ) : (
            meets.map((meet) => (
              <Link
                key={meet.id}
                href={`/meets/${meet.id}`}
                className="block p-5 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-slate-900 group-hover:text-blue-700 truncate">
                      {meet.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      {meet.date_start && (
                        <span>
                          {new Date(meet.date_start).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </span>
                      )}
                      {meet.location && <span>· {meet.location}</span>}
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600">
                        {meet.course_type}
                      </span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Create `/meets/[id]` page**

```tsx
// app/meets/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMeetResults } from '@/lib/swimcloud';

type MeetData = Awaited<ReturnType<typeof getMeetResults>>;

export default function MeetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<MeetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    getMeetResults(Number(id)).then(result => {
      setData(result);
      setLoading(false);
    });
  }, [id]);

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.meet) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Meet not found.</p>
      </div>
    );
  }

  const { meet, events } = data;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/meets" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          ← All Meets
        </Link>

        <div className="mt-6 mb-8">
          <h1 className="text-3xl font-bold text-slate-900">{meet.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-slate-600">
            {meet.date_start && (
              <span>{new Date(meet.date_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            )}
            {meet.location && <span>· {meet.location}</span>}
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm font-medium">
              {meet.course_type}
            </span>
          </div>
        </div>

        {events.length === 0 ? (
          <p className="text-slate-500">No individual results available for this meet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.eventId} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggleEvent(event.eventId)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-800">{event.eventName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{event.results.length} results</span>
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${expandedEvents.has(event.eventId) ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {expandedEvents.has(event.eventId) && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
                          <th className="px-6 py-2 font-semibold w-10">#</th>
                          <th className="px-6 py-2 font-semibold">Athlete</th>
                          <th className="px-6 py-2 font-semibold">Team</th>
                          <th className="px-6 py-2 font-semibold text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {event.results.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-6 py-2.5 text-slate-400 font-mono text-xs">{r.place ?? idx + 1}</td>
                            <td className="px-6 py-2.5 font-medium text-slate-800">{r.athleteName}</td>
                            <td className="px-6 py-2.5 text-slate-500 text-xs capitalize">{r.teamSlug.replace(/-/g, ' ')}</td>
                            <td className="px-6 py-2.5 text-right font-mono font-semibold text-blue-700">{r.timeFormatted}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

**Step 3: Add Meets link to Navigation**

In `components/Navigation.tsx`, after the logo `<h1>`, add inside the desktop actions div before the search bar:

```tsx
<Link
  href="/meets"
  className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
  Meets
</Link>
```

Also add `import Link from 'next/link';` to Navigation.tsx imports.

**Step 4: Build and verify**

```bash
npm run build
```

Visit `/meets` — should show list of meets (or empty state). Click a meet → `/meets/[id]` with collapsible event accordion.

**Step 5: Commit**

```bash
git add app/meets/page.tsx "app/meets/[id]/page.tsx" components/Navigation.tsx
git commit -m "feat: add meets browser page and meet detail page with event accordion"
```

---

## Task 7: Home Page Polish

**Files:**
- Modify: `components/HeroSection.tsx`
- Modify: `components/FilterPills.tsx`
- Create: `components/TopPerformersStrip.tsx`
- Modify: `app/page.tsx` (add TopPerformersStrip)

**Step 1: Read HeroSection and FilterPills first**

Read the files before editing:
- `components/HeroSection.tsx`
- `components/FilterPills.tsx`

**Step 2: Update HeroSection to show live stat bar**

In `HeroSection.tsx`, add a props interface and stat bar below the existing headline:

```tsx
interface HeroSectionProps {
  teamCount: number;
  athleteCount: number;
  meetCount: number;
}

// Add stat bar inside the hero JSX, below the main text:
<div className="flex items-center justify-center gap-6 mt-6 text-white/70 text-sm">
  <div className="flex items-center gap-2">
    <span className="font-bold text-white text-lg">{teamCount}</span>
    <span>teams</span>
  </div>
  <div className="w-px h-4 bg-white/30" />
  <div className="flex items-center gap-2">
    <span className="font-bold text-white text-lg">{athleteCount.toLocaleString()}</span>
    <span>athletes</span>
  </div>
  <div className="w-px h-4 bg-white/30" />
  <div className="flex items-center gap-2">
    <span className="font-bold text-white text-lg">{meetCount}</span>
    <span>meets tracked</span>
  </div>
</div>
```

Pass the counts from `app/page.tsx`:
```tsx
// In page.tsx, add state:
const [meetCount, setMeetCount] = useState(0);

// In fetchTeams(), also fetch meet count:
const { count } = await supabase.from('swim_meets').select('id', { count: 'exact', head: true });
setMeetCount(count ?? 0);

// Pass to HeroSection:
<HeroSection teamCount={teams.length} athleteCount={teams.reduce((s, t) => s + t.athlete_count, 0)} meetCount={meetCount} />
```

**Step 3: Add count badges to FilterPills**

In `FilterPills.tsx`, each conference pill should show its team count. The `counts.conference` map already has the data. Modify the conference pill render:

```tsx
// Change the conference pill button content from just the label to:
<span>{label}</span>
{count > 0 && (
  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
    isSelected ? 'bg-white/20' : 'bg-slate-200 text-slate-600'
  }`}>
    {count}
  </span>
)}
```

**Step 4: Create `TopPerformersStrip`**

```tsx
// components/TopPerformersStrip.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatSwimTime } from '@/lib/swimcloud';
import { isExternalUrl } from '@/lib/image-utils';

const FEATURED_EVENTS = ['50FR', '100FR', '200FR', '100FLY', '200FLY', '100BK', '200BK', '100BR', '200BR', '200IM', '400IM'];

const EVENT_LABELS: Record<string, string> = {
  '50FR': '50 Free', '100FR': '100 Free', '200FR': '200 Free',
  '100FLY': '100 Fly', '200FLY': '200 Fly',
  '100BK': '100 Back', '200BK': '200 Back',
  '100BR': '100 Breast', '200BR': '200 Breast',
  '200IM': '200 IM', '400IM': '400 IM',
};

interface Performer {
  athleteName: string;
  athleteId: string | null;
  teamName: string;
  teamSlug: string;
  photoUrl: string | null;
  timeFormatted: string;
  place: number;
}

export default function TopPerformersStrip() {
  const [event, setEvent] = useState('100FR');
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadTopPerformers(event).then(p => {
      setPerformers(p);
      setLoading(false);
    });
  }, [event]);

  return (
    <section className="py-10 bg-white border-t border-slate-100">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Top Performers</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FEATURED_EVENTS.map(e => (
              <button
                key={e}
                onClick={() => setEvent(e)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  e === event
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {EVENT_LABELS[e]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-44 h-56 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : performers.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No results yet — run the SwimCloud scraper to populate data.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {performers.map((p, i) => (
              <Link
                key={i}
                href={p.athleteId ? `/athlete/${p.athleteId}` : '#'}
                className="flex-shrink-0 w-44 bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="h-32 bg-slate-200 relative overflow-hidden">
                  {p.photoUrl ? (
                    isExternalUrl(p.photoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.athleteName} referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.athleteName}
                        className="w-full h-full object-cover object-top" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-3xl font-bold">
                      {p.athleteName.charAt(0)}
                    </div>
                  )}
                  <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {i + 1}
                  </div>
                </div>
                <div className="p-3">
                  <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-700">{p.athleteName}</p>
                  <p className="text-xs text-slate-500 truncate capitalize">{p.teamName}</p>
                  <p className="mt-2 font-mono font-bold text-blue-700 text-sm">{p.timeFormatted}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

async function loadTopPerformers(eventId: string): Promise<Performer[]> {
  // Get top 10 results for this event across all athletes
  const { data: results } = await supabase
    .from('swim_individual_results')
    .select('athlete_id, final_time_ms, final_place')
    .eq('event_id', eventId)
    .not('final_time_ms', 'is', null)
    .order('final_time_ms', { ascending: true })
    .limit(20);

  if (!results || results.length === 0) return [];

  // Deduplicate — keep only best time per athlete
  const best = new Map<string, typeof results[0]>();
  for (const r of results) {
    if (!best.has(r.athlete_id) || r.final_time_ms! < best.get(r.athlete_id)!.final_time_ms!) {
      best.set(r.athlete_id, r);
    }
  }

  const topAthleteIds = [...best.keys()].slice(0, 10);

  // Look up athlete details
  const { data: swimAthletes } = await supabase
    .from('swim_athletes')
    .select('swimcloud_id, name, team_id, headshot_url')
    .in('swimcloud_id', topAthleteIds);

  if (!swimAthletes) return [];

  // Try to match to web app athletes for links
  const { data: webAthletes } = await supabase
    .from('athletes')
    .select('id, name, team_id, photo_url');

  return topAthleteIds.map((swimcloudId, rank) => {
    const swimAthlete = swimAthletes.find(a => a.swimcloud_id === swimcloudId);
    if (!swimAthlete) return null;

    const result = best.get(swimcloudId)!;
    const webAthlete = webAthletes?.find(a =>
      a.name.toLowerCase().includes(swimAthlete.name.split(' ').slice(-1)[0].toLowerCase())
    );

    return {
      athleteName: swimAthlete.name,
      athleteId: webAthlete?.id ?? null,
      teamName: swimAthlete.team_id.replace(/-/g, ' '),
      teamSlug: swimAthlete.team_id,
      photoUrl: webAthlete?.photo_url ?? swimAthlete.headshot_url ?? null,
      timeFormatted: formatSwimTime(result.final_time_ms!),
      place: rank + 1,
    };
  }).filter(Boolean) as Performer[];
}
```

**Step 5: Add TopPerformersStrip to `app/page.tsx`**

```tsx
import TopPerformersStrip from '@/components/TopPerformersStrip';

// Add before the conference sections in the JSX:
{!loading && <TopPerformersStrip />}
```

**Step 6: Build and verify**

```bash
npm run build
npm run dev
```

Open http://localhost:3000. Verify:
- Hero shows stat bar with team/athlete/meet counts
- Conference pills show team counts
- TopPerformersStrip appears with event selector (shows empty state if no scraper data yet)

**Step 7: Commit**

```bash
git add components/HeroSection.tsx components/FilterPills.tsx components/TopPerformersStrip.tsx app/page.tsx
git commit -m "feat: home page polish — stat bar, conference pill counts, top performers strip"
```

---

## Task 8: Deploy to Vercel

**Step 1: Verify production build passes**

```bash
npm run build
```

Expected: No errors.

**Step 2: Push to trigger Vercel deploy**

```bash
git push
```

**Step 3: Verify on production**

- Check https://ncaa-swim-dive-tracker.vercel.app
- Test favorites drawer
- Test `/meets` page
- Test an athlete detail page for best times

---

## Summary

| Task | Effort | Impact |
|---|---|---|
| 1. Fix SC photos | 30 min | 3 athletes get headshots |
| 2. Favorites drawer | 2 hrs | Navigation favorites button works |
| 3. SwimCloud scraper | 1–4 hrs | Database populated with real results |
| 4. swimcloud.ts bridge | 1 hr | Results queryable from web app |
| 5. Athlete best times | 1.5 hrs | Athlete pages show real times |
| 6. Meets browser | 2 hrs | New /meets and /meets/[id] pages |
| 7. Home page polish | 2 hrs | Stat bar, performer strip |
| 8. Deploy | 15 min | Live on Vercel |
