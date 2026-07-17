# CONSOLIDATION-READY — athletes vs swim_athletes

Verified 2026-07-16 against Supabase project `dtnozcqkuzhjmjvsfjqk` using read-only SELECTs only.
Note: the prior SWIM-SCHEMA-AUDIT.md referenced in planning is no longer present in the repo root; all numbers below were re-derived live and superseded the audit's (~1,548 / ~801 / ~752).

## 1. Verified counts (live)

| Metric | Value |
|---|---|
| `athletes` rows | **1,877** (1,784 active / 93 `is_archived`) |
| `swim_athletes` rows | **1,043** (all `status='active'`) |
| `teams` rows | 53 (uuid PK) |
| `swim_teams` rows | 76 (text-slug PK) |
| Overlap on (lower(trim(name)), team) w/ Cal↔California + Utah↔Utah Utes mapping | **958 distinct pairs** = 958 legacy rows ↔ 964 swim rows |
| `athletes`-only rows | **919** |
| `swim_athletes`-only rows | **79** |
| Overlap after also collapsing internal whitespace (`\s+`→ single space) | 970 legacy matched / 907 athletes-only / 67 swim-only |

Cross-checks: 958 + 919 = 1,877 and 964 + 79 = 1,043. Neither table has NULL or dangling `team_id`. All 53 `teams` names map into `swim_teams` after the Cal/Utah normalization; `swim_teams` has 23 teams `teams` lacks (Air Force, BYU, Wyoming, Grand Canyon, Hawaii, Miami-FL/OH, etc.). Both tables were last written mid-June 2026 (athletes 06-17, swim_athletes 06-16) — neither is dead.

### Join used (team names live in lookup tables, not on the athlete rows)
- `athletes.team_id (uuid) → teams.id`, name = `teams.name`
- `swim_athletes.team_id (text slug, e.g. 'nc-state') → swim_teams.id`, name = `swim_teams.name`
- Normalizer applied to both sides: `CASE lower(trim(name)) WHEN 'california' THEN 'cal' WHEN 'utah utes' THEN 'utah' ELSE lower(trim(name)) END`

### Only-set character
- **athletes-only (919):** 737 active swimmers, 85 active untyped, 10 active divers, 87 archived, 3 junk placeholder rows (". Team Diving" @ Arizona / Arizona State / West Virginia). Samples: "A.J. Stone" (Navy), "Aaron  Gordon" (Arizona — double space; exists in swim_athletes as "Aaron Gordon", i.e. some of these are whitespace false-negatives, ~12 rows).
- **swim_athletes-only (79):** mostly athletes on the 23 swim-only teams (e.g. "Alex Metzler"/Wyoming, "Aidan Favela"/UNLV) plus name-variant misses ("Alex DESANGLES"/Arizona, "Abdallah Ahmed Nasr"/Auburn).
- **Duplicates in swim_athletes:** 6 (name, team) pairs each ×2 — alan vergine/pittsburgh, derek colbert/missouri, kris mihaylov/georgia, merlin belmon/pittsburgh, pierre largeron/south-carolina, sohib khaled/auburn. `athletes` has none among matched pairs.

### Column mapping (legacy → modern) — clean, no blockers
`name→name`, `class_year→year`, `photo_url→headshot_url`, `profile_url→roster_url`, `hometown→hometown`, `athlete_type→athlete_type` (case inconsistent: 'swimmer' vs 'Swimmer'), `is_archived→status`, `team_id(uuid)→team_id(slug)` via team-name mapping. Both PKs are uuid, so legacy ids can be preserved on backfill. swim_athletes additionally has `events[]`, `ranking`, `swimcloud_id`, `high_school`, `club`, `height`, `weight`.

### Referential blast radius: minimal
- Only FKs touching these tables: `athletes.team_id→teams`, `swim_athletes.team_id→swim_teams`. Nothing FK-references either athlete table.
- `csd_anon_favorites` (athlete_id text) and `swim_user_favorites` (athlete_id text) are both **0 rows** — no user data to migrate.

## 2. Legacy code dependencies (`.from('athletes')` / `FROM athletes`)

**Live code — 24 refs in 12 files (must change at cutover):**

| File | Lines | Role |
|---|---|---|
| app/page.tsx | 168, 172, 291, 489 | read (home/rosters) |
| app/athlete/[id]/page.tsx | 59, 77 | read (detail) |
| app/search/page.tsx | 32 | read (search) |
| app/team/[id]/page.tsx | 77 | read (team roster) |
| app/api/update/route.ts | 503 | **write (upsert)** |
| components/Navigation.tsx | 70 | read (global search) |
| components/TopPerformersStrip.tsx | 143 | read (photo enrichment; already reads swim_athletes at 59, 112 and joins by name) |
| scripts/upgrade-image-quality.ts | 13, 39 | script |
| scripts/scrape-athletes.ts | 361 | script (insert) |
| scripts/scrape-athletes-v2.ts | 469, 482 | script (insert) |
| scripts/rescrape-teams.ts | 341 | script |
| scripts/update-missing-data.ts | 358, 389, 425, 448 | script |
| scripts/staging/rescrape-rosters.mjs | 52 | **active roster refresher (upsert)** |
| scripts/staging/swimcloud-roster-apply.mjs | 28, 40, 41 | staging script |
| check-teams.js | 29 | root utility |

(check-teams.js counts as the 12th app-adjacent file; the table lists 15 entries because scripts are included.)

**Non-blocking references:** ~60 files under `archive/scripts/` (historical one-offs), plus docs (`docs/plans/*`, SCRAPER-IMPLEMENTATION-GUIDE.md, EXECUTION-SUMMARY.txt, scripts/staging/SWIMCLOUD-ROSTER-REFRESH.md). Leave as-is.

**Modern-side live readers:** only `lib/swimcloud.ts` (81, 265) and `components/TopPerformersStrip.tsx` (59, 112). **There is no live writer for swim_athletes** — its import scripts live in archive/. The actively-maintained ingestion path (app/api/update, rescrape-rosters.mjs) writes `athletes`.

## 3. Recommended cutover plan

Direction: consolidate onto **`swim_athletes` + `swim_teams`** as canonical (they're integrated with the swim_* results ecosystem, cover 76 teams vs 53, and carry richer columns), backfilling the roster coverage that only `athletes` has today. All DB writes below are FUTURE work — nothing has been executed; this prep was strictly read-only.

1. **Clean modern table (migration script, small):** delete the worse half of the 6 duplicate pairs (keep row with `swimcloud_id`/`ranking`/most fields), normalize `athlete_type` casing, then add unique index on `(team_id, lower(name))` to keep it clean.
2. **Backfill from legacy:** insert the athletes-only set into `swim_athletes` — whitespace-normalize names, skip the 3 ". Team Diving" junk rows, map columns per table above, map teams by name (Cal→cal, Utah Utes→utah), carry `is_archived` → `status='archived'`, and **preserve legacy uuid as the new row's id**. Record inserted ids to scripts/staging/backfill-manifest.json for rollback. Expected inserts: ~904 (832 active + ~87 archived − dupes caught by the new index).
3. **Repoint the writers first, same deploy as readers:** app/api/update/route.ts upsert and scripts/staging/rescrape-rosters.mjs move to `swim_athletes`/`swim_teams` (or pause scraping during the window). Then flip the 7 UI read sites + scripts; TopPerformersStrip drops its name-join enrichment hack entirely. One PR, one deploy.
4. **Verify:** per-team counts old-vs-new (SELECT parity check), spot-check athlete detail pages incl. a Cal and a Utah athlete, search, and top performers. Regenerate TS types.
5. **Decommission after 2–4 weeks burn-in:** rename `athletes`→`athletes_legacy_YYYYMMDD` (keep 30 days), then drop; decide `teams` separately (UI still needs `logo_fallback_url`/`conference_display_name`, which `swim_teams` lacks — port those two columns to `swim_teams` before retiring `teams`).

**Rollback:** revert the code PR — legacy tables are untouched until step 5, so the app immediately works again. If the backfill itself must be undone, delete exactly the ids in backfill-manifest.json (they're also identifiable by the backfill run's `created_at`).

## 4. Open decisions for Chace

1. **Confirm direction** — plan above assumes swim_athletes wins. The counter-signal: today's live ingestion writes `athletes`, and swim_athletes has no live writer. If you'd rather keep `athletes` canonical, the same numbers support the mirror-image plan (enrich athletes with swimcloud_id/events/ranking; ~67 swim-only athletes + 23 teams to import).
2. **Archived athletes** — carry the 87 archived legacy rows into swim_athletes as `status='archived'` (recommended, keeps history) or drop them?
3. **Divers** — swim_athletes-only ecosystem is swim-centric; confirm the 17 legacy divers (10 active/7 archived) belong in swim_athletes (`athlete_type='diver'` exists there too — recommended yes, it's the "swim & dive" tracker).
4. **UI team scope** — post-cutover the app would surface 76 teams instead of 53. Intentional expansion, or filter to the original 53 for now?
5. **Dedupe winner rule** for the 6 duplicate pairs — "keep row with swimcloud_id, else newest" OK?
6. **teams table retirement timing** — port `logo_fallback_url` + `conference_display_name` to swim_teams in the same migration, or keep `teams` alive as team-metadata source for a while (Navigation.tsx, useFavorites.ts, page.tsx also read `teams` directly)?
