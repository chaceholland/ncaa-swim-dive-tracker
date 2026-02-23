# NCAA Swim & Dive Tracker — Features & UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add athlete detail pages, global live-search dropdown, a search results page, a featured athletes strip on the home page, and visual polish on athlete cards and the team page header.

**Architecture:** Next.js App Router with Supabase for all data. No new dependencies — Framer Motion and Tailwind are already installed. New pages (`/athlete/[id]`, `/search`) follow the existing client-component pattern: `'use client'` + `useEffect` for data fetching. Existing components get targeted edits only.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Framer Motion 12, Supabase JS, TypeScript

---

## Codebase Context

- `lib/supabase/client.ts` — exports `createClient()`
- `lib/supabase/types.ts` — `Team` and `Athlete` interfaces
- `components/AthleteCard.tsx` — athlete card with photo, badges, favorite button; currently ~280×380px fixed size
- `components/TeamCard.tsx` — team card with gradient and logo
- `components/Navigation.tsx` — sticky nav with existing `SearchBar` component and glassmorphism
- `components/HeroSection.tsx` — hero banner with animated stats
- `components/ui/Badge.tsx` — variants: `swimmer`, `diver`, `freshman`, `sophomore`, `junior`, `senior`, `default`
- `components/ui/Button.tsx` — variants: `primary`, `secondary`, `outline`, `ghost`; sizes: `sm`, `md`, `lg`
- `app/page.tsx` — home page, fetches teams from Supabase, groups by conference
- `app/team/[id]/page.tsx` — team roster page, athlete grid
- `app/globals.css` — global styles

---

## Task 1: Athlete Detail Page

**Files:**
- Create: `app/athlete/[id]/page.tsx`
- Modify: `components/AthleteCard.tsx` (add click-to-navigate)

**Step 1: Create `app/athlete/[id]/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { Athlete, Team } from '@/lib/supabase/types';
import { Button } from '@/components/ui/Button';
import AthleteCard from '@/components/AthleteCard';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '30, 64, 175';
}

export default function AthletePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teammates, setTeammates] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: athleteData } = await supabase
        .from('athletes')
        .select('*')
        .eq('id', id)
        .single();

      if (!athleteData) { router.push('/'); return; }
      setAthlete(athleteData);

      const [{ data: teamData }, { data: teammatesData }] = await Promise.all([
        supabase.from('teams').select('*').eq('id', athleteData.team_id).single(),
        supabase.from('athletes').select('*')
          .eq('team_id', athleteData.team_id)
          .neq('id', id)
          .order('name')
          .limit(8),
      ]);

      setTeam(teamData);
      setTeammates(teammatesData || []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-72 bg-gray-200 animate-pulse" />
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!athlete || !team) return null;

  const primary = team.primary_color || '#1e40af';
  const secondary = team.secondary_color || '#1e3a8a';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Gradient header */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 60%),
              radial-gradient(circle at 80% 50%, rgba(255,255,255,0.2) 0%, transparent 60%)`,
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 py-12 flex gap-10 items-center">
          <button
            onClick={() => router.back()}
            className="absolute top-6 left-6 text-white/70 hover:text-white flex items-center gap-1 text-sm transition-colors"
          >
            ← Back
          </button>

          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 mt-6"
          >
            <div className="w-48 h-56 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-white/10">
              {athlete.photo_url && !photoError ? (
                <Image
                  src={athlete.photo_url}
                  alt={athlete.name}
                  width={192}
                  height={224}
                  className="w-full h-full object-cover object-top"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60 text-4xl font-bold">
                  {getInitials(athlete.name)}
                </div>
              )}
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 text-white mt-6"
          >
            <div className="flex items-center gap-3 mb-2">
              {team.logo_url && (
                <Image src={team.logo_url} alt={team.name} width={28} height={28}
                  className="w-7 h-7 object-contain" />
              )}
              <Link href={`/team/${team.id}`}
                className="text-white/80 hover:text-white text-sm font-medium transition-colors">
                {team.name}
              </Link>
              {team.conference_display_name && (
                <>
                  <span className="text-white/40">·</span>
                  <span className="text-white/60 text-sm">{team.conference_display_name}</span>
                </>
              )}
            </div>

            <h1 className="text-4xl font-bold mb-4">{athlete.name}</h1>

            <div className="flex flex-wrap gap-2 mb-6">
              {athlete.athlete_type && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  {athlete.athlete_type.charAt(0).toUpperCase() + athlete.athlete_type.slice(1)}
                </span>
              )}
              {athlete.class_year && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  {athlete.class_year.charAt(0).toUpperCase() + athlete.class_year.slice(1)}
                </span>
              )}
              {athlete.hometown && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  📍 {athlete.hometown}
                </span>
              )}
            </div>

            {athlete.profile_url && (
              <a href={athlete.profile_url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="md">
                  Official Profile →
                </Button>
              </a>
            )}
          </motion.div>
        </div>
      </div>

      {/* Teammates grid */}
      {teammates.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            More from {team.name}
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {teammates.slice(0, 8).map(tm => (
              <AthleteCard
                key={tm.id}
                athlete={tm}
                teamColor={primary}
                isFavorite={false}
                onFavoriteToggle={() => {}}
                onReportIssue={() => {}}
                hasReportedIssue={false}
              />
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href={`/team/${team.id}`}>
              <Button variant="outline" size="md">View Full Roster</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Make AthleteCard navigate to `/athlete/[id]` on click**

Open `components/AthleteCard.tsx`. Add `useRouter` import and navigate on card click. Find the outermost wrapper element (likely a `motion.div`) and add `onClick` and `cursor-pointer`:

```tsx
// Add at top:
import { useRouter } from 'next/navigation';

// Inside component:
const router = useRouter();

// On the outermost motion.div (or whatever wraps the card):
onClick={() => router.push(`/athlete/${athlete.id}`)}
// Add to its className: cursor-pointer
```

**Step 3: Verify**

- Run `npm run dev`
- Go to any team page, click an athlete card → should navigate to `/athlete/[id]`
- Page shows gradient header with athlete photo, name, stats
- "More from [Team]" shows up to 8 teammates
- "Official Profile" button only appears if `profile_url` is set
- Back button returns to previous page

**Step 4: Commit**

```bash
git add app/athlete/[id]/page.tsx components/AthleteCard.tsx
git commit -m "feat: add athlete detail page with team gradient header and teammates grid"
```

---

## Task 2: Global Search Dropdown in Navigation

**Files:**
- Modify: `components/Navigation.tsx`

**Step 1: Read `components/Navigation.tsx` fully before editing**

The file is 193 lines. Understand the existing search bar setup before modifying.

**Step 2: Add imports and state to Navigation.tsx**

At the top of the file add any missing imports:

```tsx
import { useRef, useState, useEffect } from 'react'; // may already exist
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { Athlete, Team } from '@/lib/supabase/types';
```

Inside the `Navigation` component add:

```tsx
const router = useRouter();
const supabase = createClient();
const [dropdownQuery, setDropdownQuery] = useState('');
const [athleteResults, setAthleteResults] = useState<Athlete[]>([]);
const [teamResults, setTeamResults] = useState<(Pick<Team, 'id' | 'name' | 'logo_url' | 'conference_display_name'>)[]>([]);
const [showDropdown, setShowDropdown] = useState(false);
const dropdownRef = useRef<HTMLDivElement>(null);
```

**Step 3: Add debounced search effect**

```tsx
useEffect(() => {
  if (!dropdownQuery.trim() || dropdownQuery.length < 2) {
    setAthleteResults([]);
    setTeamResults([]);
    setShowDropdown(false);
    return;
  }
  const timer = setTimeout(async () => {
    const q = `%${dropdownQuery.trim()}%`;
    const [{ data: athletes }, { data: teams }] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, name, photo_url, class_year, athlete_type, team_id')
        .ilike('name', q)
        .limit(5),
      supabase
        .from('teams')
        .select('id, name, logo_url, conference_display_name')
        .ilike('name', q)
        .limit(3),
    ]);
    setAthleteResults(athletes || []);
    setTeamResults(teams || []);
    setShowDropdown(true);
  }, 300);
  return () => clearTimeout(timer);
}, [dropdownQuery]);
```

**Step 4: Add click-outside handler**

```tsx
useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

**Step 5: Replace the search bar section with controlled input + dropdown**

Find the existing `SearchBar` component usage in the JSX. Wrap it in a `ref={dropdownRef}` relative-positioned div, replace or augment the input with a controlled one using `dropdownQuery`, and add the dropdown JSX below it:

```tsx
<div ref={dropdownRef} className="relative">
  {/* Replace existing SearchBar or wrap its input with these handlers: */}
  <input
    type="text"
    value={dropdownQuery}
    onChange={e => setDropdownQuery(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter' && dropdownQuery.trim()) {
        router.push(`/search?q=${encodeURIComponent(dropdownQuery.trim())}`);
        setShowDropdown(false);
      }
      if (e.key === 'Escape') setShowDropdown(false);
    }}
    placeholder="Search athletes or teams..."
    className="w-64 px-4 py-2 rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
  />

  {/* Dropdown */}
  {showDropdown && (athleteResults.length > 0 || teamResults.length > 0) && (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
      {athleteResults.length > 0 && (
        <>
          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
            Athletes
          </div>
          {athleteResults.map(a => (
            <button
              key={a.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left"
              onClick={() => {
                router.push(`/athlete/${a.id}`);
                setShowDropdown(false);
                setDropdownQuery('');
              }}
            >
              <div className="w-8 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {a.photo_url ? (
                  <Image src={a.photo_url} alt={a.name} width={32} height={36}
                    className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                    {a.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{a.name}</div>
                <div className="text-xs text-gray-400">
                  {a.class_year
                    ? a.class_year.charAt(0).toUpperCase() + a.class_year.slice(1)
                    : ''}{a.athlete_type ? ` · ${a.athlete_type}` : ''}
                </div>
              </div>
            </button>
          ))}
        </>
      )}

      {teamResults.length > 0 && (
        <>
          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-t border-b border-gray-100">
            Teams
          </div>
          {teamResults.map(t => (
            <button
              key={t.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left"
              onClick={() => {
                router.push(`/team/${t.id}`);
                setShowDropdown(false);
                setDropdownQuery('');
              }}
            >
              {t.logo_url && (
                <Image src={t.logo_url} alt={t.name} width={28} height={28}
                  className="w-7 h-7 object-contain flex-shrink-0" />
              )}
              <div>
                <div className="text-sm font-medium text-gray-800">{t.name}</div>
                <div className="text-xs text-gray-400">{t.conference_display_name}</div>
              </div>
            </button>
          ))}
        </>
      )}

      <button
        className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50 font-medium transition-colors border-t border-gray-100"
        onClick={() => {
          router.push(`/search?q=${encodeURIComponent(dropdownQuery)}`);
          setShowDropdown(false);
        }}
      >
        View all results for "{dropdownQuery}" →
      </button>
    </div>
  )}
</div>
```

**Step 6: Verify**

- Type "smith" in the nav — dropdown appears within 300ms
- Click an athlete result → navigates to `/athlete/[id]`, dropdown closes
- Click a team result → navigates to `/team/[id]`, dropdown closes
- Press Enter → navigates to `/search?q=smith`
- Press Escape → dropdown closes
- Click outside dropdown → dropdown closes

**Step 7: Commit**

```bash
git add components/Navigation.tsx
git commit -m "feat: add live search dropdown with athlete and team results in nav"
```

---

## Task 3: Search Results Page

**Files:**
- Create: `app/search/page.tsx`

**Step 1: Create `app/search/page.tsx`**

```tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { Athlete, Team } from '@/lib/supabase/types';
import { Badge } from '@/components/ui/Badge';

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get('q') || '';
  const supabase = createClient();

  const [query, setQuery] = useState(q);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(q);
    if (!q.trim()) return;
    setLoading(true);
    const pattern = `%${q.trim()}%`;
    Promise.all([
      supabase.from('athletes').select('*').ilike('name', pattern).limit(50),
      supabase.from('teams').select('*').ilike('name', pattern).limit(20),
    ]).then(async ([{ data: athleteData }, { data: teamData }]) => {
      setAthletes(athleteData || []);
      setTeams(teamData || []);
      const teamIds = [...new Set((athleteData || []).map(a => a.team_id))];
      if (teamIds.length > 0) {
        const { data: relatedTeams } = await supabase
          .from('teams').select('*').in('id', teamIds);
        const map: Record<string, Team> = {};
        (relatedTeams || []).forEach(t => { map[t.id] = t; });
        setTeamMap(map);
      }
      setLoading(false);
    });
  }, [q]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search bar header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search athletes or teams..."
              autoFocus
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>
          {!loading && q && (
            <p className="mt-3 text-sm text-gray-500">
              {athletes.length + teams.length} result{athletes.length + teams.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8">
        {/* Athletes — left, dominant */}
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Athletes {!loading && `(${athletes.length})`}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : athletes.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No athletes found.</p>
          ) : (
            <div className="space-y-2">
              {athletes.map((a, i) => {
                const t = teamMap[a.team_id];
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                  >
                    <Link
                      href={`/athlete/${a.id}`}
                      className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group"
                    >
                      <div className="w-12 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {a.photo_url && !a.photo_url.startsWith('/logos/') ? (
                          <Image src={a.photo_url} alt={a.name} width={48} height={56}
                            className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                            {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors truncate">
                          {a.name}
                        </div>
                        <div className="text-sm text-gray-400 truncate">
                          {t?.name}
                          {a.class_year && ` · ${a.class_year.charAt(0).toUpperCase() + a.class_year.slice(1)}`}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {a.athlete_type && (
                          <Badge variant={a.athlete_type as 'swimmer' | 'diver'}>
                            {a.athlete_type}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Teams — right sidebar */}
        <div className="w-64 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Teams {!loading && `(${teams.length})`}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <p className="text-gray-400 text-sm">No teams found.</p>
          ) : (
            <div className="space-y-2">
              {teams.map(t => (
                <Link
                  key={t.id}
                  href={`/team/${t.id}`}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group"
                >
                  {t.logo_url && (
                    <Image src={t.logo_url} alt={t.name} width={36} height={36}
                      className="w-9 h-9 object-contain flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-800 group-hover:text-blue-700 transition-colors truncate">
                      {t.name}
                    </div>
                    <div className="text-xs text-gray-400">{t.conference_display_name}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <SearchResults />
    </Suspense>
  );
}
```

**Step 2: Verify**

- Navigate to `/search?q=smith` directly — athlete rows appear with photos on left, teams on right
- Clicking an athlete row goes to `/athlete/[id]`
- Clicking a team goes to `/team/[id]`
- Submitting new query in the search bar updates results
- Skeleton loading state shows while fetching

**Step 3: Commit**

```bash
git add app/search/page.tsx
git commit -m "feat: add search results page with athlete rows and team sidebar"
```

---

## Task 4: Featured Athletes Strip on Home Page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Step 1: Read `app/page.tsx` to find where to add the strip**

The file is ~555 lines. Find the section after the hero/filter area where conference sections begin. The strip goes between the filters and the conference sections.

**Step 2: Add featured athletes fetch**

In the data-fetching section of `app/page.tsx` (wherever `supabase.from('teams')` is called), add a parallel fetch:

```tsx
const { data: featuredRaw } = await supabase
  .from('athletes')
  .select('id, name, photo_url, team_id')
  .not('photo_url', 'is', null)
  .not('photo_url', 'like', '/logos/%')
  .not('photo_url', 'like', '%dummy%')
  .limit(40);

// Shuffle client-side and take 16
const featuredAthletes = (featuredRaw || [])
  .sort(() => Math.random() - 0.5)
  .slice(0, 16);
```

**Step 3: Add the strip JSX**

Insert this block between the filter pills and the conference sections in the JSX:

```tsx
{/* Featured Athletes Strip */}
{featuredAthletes.length > 0 && (
  <div className="px-6 py-4">
    <h2 className="text-base font-semibold text-gray-700 mb-3">Featured Athletes</h2>
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {featuredAthletes.map(a => (
        <a
          key={a.id}
          href={`/athlete/${a.id}`}
          className="flex-shrink-0 group text-center w-[72px]"
        >
          <div className="w-[72px] h-[86px] rounded-xl overflow-hidden bg-gray-100 mb-1.5 shadow-sm group-hover:shadow-md transition-shadow border border-gray-200">
            <Image
              src={a.photo_url!}
              alt={a.name}
              width={72}
              height={86}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="text-xs font-medium text-gray-600 truncate w-[72px] group-hover:text-blue-600 transition-colors">
            {a.name.split(' ')[0]}
          </div>
        </a>
      ))}
    </div>
  </div>
)}
```

**Step 4: Add scrollbar-hide utility to globals.css**

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

**Step 5: Verify**

Home page shows a horizontal scrollable strip of athlete avatar photos above the conference sections. Each is clickable and goes to `/athlete/[id]`. Strip scrolls without showing a scrollbar. Photos look like portraits (not logos).

**Step 6: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat: add featured athletes horizontal strip on home page"
```

---

## Task 5: Visual Polish — Athlete Cards & Team Page Header

**Files:**
- Modify: `components/AthleteCard.tsx`
- Modify: `app/team/[id]/page.tsx`

**Step 1: Read both files fully before editing**

AthleteCard.tsx is 296 lines. app/team/[id]/page.tsx is 619 lines.

**Step 2: Update AthleteCard — larger photo with portrait ratio**

Find the photo container in AthleteCard.tsx. Change it to use `aspect-[3/4]` instead of a fixed height so the photo fills a proper portrait frame:

```tsx
{/* Replace the existing photo container div's sizing classes with: */}
<div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-100">
  {/* keep existing photo/initials/loading JSX inside */}
</div>
```

The card's outer container should be `w-full` rather than a fixed pixel width so it responds to the grid column width.

**Step 3: Update AthleteCard — tighten info section**

In the info area below the photo, ensure the name is `font-bold text-sm` and tight, badges are small, hometown is `text-xs text-gray-400`:

```tsx
<div className="p-3 flex flex-col gap-1.5">
  <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
    {athlete.name}
  </h3>
  <div className="flex flex-wrap gap-1">
    {/* existing badge JSX */}
  </div>
  {athlete.hometown && (
    <p className="text-xs text-gray-400 truncate">📍 {athlete.hometown}</p>
  )}
</div>
```

**Step 4: Update team/[id]/page.tsx header**

Find the team header section (the gradient div near the top of the team page JSX). Make the logo 80×80, name `text-3xl font-bold`, and display athlete count as a white pill badge:

```tsx
{/* Logo: update size */}
<div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center overflow-hidden">
  {team.logo_url ? (
    <Image src={team.logo_url} alt={team.name} width={64} height={64}
      className="w-16 h-16 object-contain" />
  ) : (
    <span className="text-white text-2xl font-bold">{team.name.slice(0, 2)}</span>
  )}
</div>

{/* Name + info: update font sizes */}
<div>
  <div className="text-white/70 text-sm font-medium mb-1">{team.conference_display_name}</div>
  <h1 className="text-3xl font-bold text-white mb-3">{team.name}</h1>
  <span className="px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium">
    {athletes.length} Athletes
  </span>
</div>
```

**Step 5: Verify**

- Open a team page — header shows larger logo, clean name, pill badge athlete count
- Athlete cards show taller portrait photos
- Cards are responsive to grid width
- Click any card → navigates to `/athlete/[id]`

**Step 6: Commit**

```bash
git add components/AthleteCard.tsx app/team/[id]/page.tsx
git commit -m "feat: visual polish on athlete cards and team page header"
```

---

## Final Verification & Deploy

**Run full check:**

```bash
npm run dev
```

Verify each feature:
1. ✅ Home page shows featured athletes strip
2. ✅ Typing in nav search shows live dropdown (athletes + teams)
3. ✅ Pressing Enter navigates to `/search?q=...`
4. ✅ Search page shows athlete rows (left) + team sidebar (right)
5. ✅ Clicking any athlete card/result navigates to `/athlete/[id]`
6. ✅ Athlete detail page shows gradient header, photo, stats, teammates grid
7. ✅ "Official Profile" button only shows when `profile_url` exists
8. ✅ Team page header looks polished
9. ✅ No TypeScript errors (`npm run build` passes)

**Deploy:**

```bash
vercel --prod
```
