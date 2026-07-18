# CONSOLIDATION-EXECUTION-NOTES — athletes as canonical

Executed 2026-07-16 against Supabase project `dtnozcqkuzhjmjvsfjqk`.
Direction (decided by Chace, mirror-image of CONSOLIDATION-READY.md §3): **`athletes` is canonical.** `swim_athletes` is retained and will be retired later by Chace.

Scope guardrails honored: exactly ONE live DB write (an additive INSERT into `athletes`). No UPDATE/DELETE/DROP/ALTER/TRUNCATE/RENAME, no writes to `swim_athletes`, no commit/push, no deploy. Code work done on branch `consolidate-athletes-canonical` (never on main).

## 1. Direction verification (read-only, before any write)

| Metric | athletes | swim_athletes |
|---|---|---|
| rows | 1,877 | 1,043 |
| max(updated_at) | 2026-06-17 07:38 | 2026-06-16 20:12 |
| max(created_at) | 2026-06-17 07:21 | 2026-06-16 13:54 |
| rows updated in last 30d | 637 | 39 |
| rows created in last 30d | 329 | 0 |

`athletes` is fresher and actively written (329 new rows + 637 updates in 30d); `swim_athletes` added 0 rows and touched 39 in the same window. Combined with the code evidence (no live writer for `swim_athletes`; the live ingestion path — app/api/update, scripts/staging/rescrape-rosters.mjs — writes `athletes`), the decided direction is confirmed. Did NOT stop.

## 2. Backups (read-only SELECT *)

`scripts/staging/backups/`:
- `athletes_backup_20260716.json` / `.csv` — 1,877 rows
- `swim_athletes_backup_20260716.json` / `.csv` — 1,043 rows

Produced via a temporary node script (service-role, paginated); script removed after use.

## 3. The single additive INSERT (28 rows) — DONE

Manifest / rollback: `scripts/staging/backups/inserted_ids_20260716.json` (contains the 28 ids + a ready `rollback_sql`).

Swim-only computation: `swim_athletes` rows with no match in `athletes` on normalized (name, team).
- name key = `lower(trim(name))` with internal whitespace collapsed to a single space
- team key via team-name lookup with Cal↔California and Utah↔Utah Utes mapping
- Result: 79 swim-only under trim-only matching; **67** under whitespace-collapsed matching (the extra 12 are whitespace false-negatives that already exist in `athletes` — inserting them would duplicate). Used the 67-row set.

Of the 67, only **28** belong to a team that also exists in `teams`; those 28 were inserted. Source `swim_athletes.id` preserved as `athletes.id` (verified zero PK collision). All 28 are `status='active'` → `is_archived=false`.

Column mapping applied (swim_athletes → athletes):
`id→id (preserved)`, `name→name`, `headshot_url→photo_url`, `roster_url→profile_url`, `year→class_year`, `hometown→hometown`, `athlete_type→athlete_type`, `status→is_archived (<>'active')`, `swim_teams.name → teams.id (uuid)` via normalized team lookup. `created_at`/`updated_at` = default now().

Two CHECK constraints on `athletes` forced normalization (both discovered live; first two INSERT attempts rolled back atomically with zero rows before this was handled):
- `athletes_athlete_type_check` = IN ('swimmer','diver'): source had 'Swimmer'/'swimmer' → mapped with `lower()`.
- `athletes_class_year_check` = IN ('freshman','sophomore','junior','senior','graduate'): source had 'Junior'/'Freshman'/'Senior'/'Fr'/'Gr' → mapped via CASE (Fr→freshman, Gr→graduate, etc.; unrecognized→NULL).

Post-insert verification: `athletes` 1,877 → **1,905** (exactly +28); `swim_athletes` unchanged at 1,043; all 28 manifest ids present; `athletes` rows with NULL team_id = 0 (integrity preserved).

Side effect (expected, benign): trigger `athletes_count_trigger` auto-updated `teams.athlete_count` for the affected teams on INSERT. The same trigger reverses those increments if the rollback DELETE is run.

### Deferred: 39 swim-only rows on swim-only teams (NOT inserted)
The other 39 of the 67 belong to 23 teams that exist only in `swim_teams` (Air Force, Brigham Young, Wyoming, Hawaii, California Baptist, IU-Indianapolis, Miami-FL, Miami-OH, Delaware, Drexel, South Dakota, UNC-Wilmington, La Salle, Grand Canyon, Cal State Bakersfield, Davidson, Florida Atlantic, Georgetown, Illinois-Chicago, Loyola, Milwaukee, Missouri State, Oakland). `athletes.team_id` is a uuid FK to `teams`, so these cannot get a valid team_id without first creating those 23 teams — a second write outside this operation's one-INSERT scope. They also aren't rendered by the app today (it only shows the 53 teams in `teams`), so importing them as NULL-team orphans would add integrity debt with no UI benefit. Left in `swim_athletes`. To import later: add the 23 teams to `teams`, then insert the 39 with the same column mapping.

## 4. swimcloud_id enrichment + reader repoint (Step 6) — DONE

Chace subsequently authorized the additive/reversible schema change (add + backfill
`swimcloud_id`; UPDATE on `athletes` only). Completed 2026-07-16, same branch. Still no
write to `swim_athletes`, no DROP/RENAME/TRUNCATE, no commit/push, no deploy.

### 4a. DDL (Supabase migration `20260716174347` `add_swimcloud_id_to_athletes`)
```sql
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS swimcloud_id text;
CREATE INDEX IF NOT EXISTS idx_athletes_swimcloud_id
  ON public.athletes (swimcloud_id) WHERE swimcloud_id IS NOT NULL;
```
Partial index (only ~980 of 1,905 rows carry a swimcloud_id; every repointed read
filters `.in('swimcloud_id', [...])` on non-null ids). Not made UNIQUE: kept additive/
low-risk, and the backfill produced 0 duplicate assignments anyway (verified). Column is
readable by `anon` + `authenticated` (existing "Public read athletes" policy — verified
via `has_column_privilege`), so the app can read it with no grant change.

### 4b. Backfill (single UPDATE on `athletes` only; `swim_athletes` untouched)
Matched `swim_athletes` → `athletes` on normalized **(name, team)**:
- name key = `regexp_replace(lower(trim(name)),'\s+',' ','g')` (trim + collapse internal whitespace)
- team key via team-name lookup (`teams.name` ↔ `swim_teams.name`) with `california→cal`, `utah utes→utah`
- source deduplicated with `ROW_NUMBER() … ORDER BY swimcloud_id` (keeps the lexically-smallest id) so the 6 duplicate `swim_athletes` (name,team) pairs update deterministically.

Result counts (verified):
| Metric | Value |
|---|---|
| `athletes` rows given a swimcloud_id | **980** (980 distinct; 0 duplicate assignments) |
| distinct non-null swimcloud_ids in `swim_athletes` | 1,020 (23 rows are NULL) |
| of those now present in `athletes` | **980** |
| swim swimcloud_ids that did NOT backfill | **40** |

The 40 unmatched = **39** roster rows on the 23 swim-only teams (Air Force, Brigham Young,
Wyoming, Hawaii, California Baptist, IU-Indianapolis, Miami-FL/OH, Delaware, Drexel, South
Dakota, UNC-Wilmington, La Salle, Grand Canyon, Cal State Bakersfield, Davidson, Florida
Atlantic, Georgetown, Illinois-Chicago, Loyola, Milwaukee, Missouri State, Oakland) that
have no `athletes` row (their teams aren't in `teams`), **+1** duplicate-record artifact
(Derek Colbert/Missouri — his 2nd swimcloud_id; the winning one backfilled fine).

### 4c. Orphan check (read-only, vs `swim_individual_results`)
| Metric | Value |
|---|---|
| distinct athlete_ids (swimcloud_ids) referenced by results | 11,147 |
| resolvable via `swim_athletes` today | 998 |
| resolvable via `athletes` after backfill | 958 |
| not resolvable via `athletes` (total) | 10,189 |
| …of which also NOT in `swim_athletes` (pre-existing "Athlete #id", unchanged) | 10,149 |
| **net-new orphans caused by repointing** | **40** (all appear in results) |

Interpretation: the results ecosystem references ~11k swimmers but only ~1k are on the
tracked men's roster; ~10,149 already render as "Athlete #id" today (not caused by this
work). Repointing `swim_athletes`→`athletes` would newly orphan exactly the **40** rows
from 4b. **Because that is > 0, `swim_athletes` was KEPT as a documented fallback** (not
removed) so those 40 still resolve — zero display regression.

### 4d. Files changed (code)
- `lib/supabase/types.ts` — added optional `swimcloud_id?: string | null` to the `Athlete` interface.
- `lib/swimcloud.ts` —
  - added slug override `"texas-a-m" → "texas-am"` (fixes a latent `athletes`↔swim slug mismatch; also fixes Texas A&M best-times lookup).
  - `findSwimcloudId`: now resolves via `athletes` (name + `teams.name`) first, `swim_athletes` (slug + last-name ilike) as fallback.
  - `loadMeetRows`: resolves swimcloud_id → {name, team-slug} via `athletes` (team-uuid mapped to the swim-style slug through `teamNameToSlug(teams.name)` to preserve meet grouping/display), with `swim_athletes` fallback for unresolved ids.
- `components/TopPerformersStrip.tsx` — universe = `athletes.swimcloud_id` ∪ `swim_athletes.swimcloud_id` (no eligibility regression); top-10 resolved via `athletes`-by-swimcloud_id (name, team, photo, profile id, team uuid in one lookup — the exact-match path replaces name-matching for the 958); `swim_athletes` + the name-match photo bridge **retained** as fallback for the 40.

Behavior is preserved for the resolvable set (same top-10, same meet groups; team display equal-or-better since it now comes from `teams.name`) and the 40 fallback rows still resolve. `athletes` is now the primary/canonical resolver for all four read sites.

### 4e. Verification
- `npx tsc --noEmit` → **clean (exit 0)**.
- `eslint lib/swimcloud.ts components/TopPerformersStrip.tsx lib/supabase/types.ts` → **clean**.
- `npm run build` (`next build`) → not completable in the Linux sandbox: fails in Turbopack CSS on a native-binary mismatch (`Cannot find module '../lightningcss.linux-arm64-gnu.node'` — the repo's `node_modules` were installed on macOS). This is environmental, occurs before app TS is reached, and is unrelated to these edits; it will build normally on Chace's Mac.

## 5. Rollback

Two independent, additive changes — undo either without touching `swim_athletes`:

**(a) swimcloud_id enrichment + code (this step).**
1. Code: abandon/revert branch `consolidate-athletes-canonical`. App reverts to `swim_athletes`-only resolution; no data dependency.
2. Schema (drops the column *and* the backfill in one shot — no per-row undo needed):
```sql
DROP INDEX IF EXISTS public.idx_athletes_swimcloud_id;
ALTER TABLE public.athletes DROP COLUMN IF EXISTS swimcloud_id;
-- optional: DELETE FROM supabase_migrations.schema_migrations WHERE version='20260716174347';
```

**(b) The earlier 28-row INSERT** (§3, separate): still rolled back via the manifest
`DELETE` (also reverses the `athlete_count` trigger):
```
DELETE FROM public.athletes WHERE id IN (<28 ids in inserted_ids_20260716.json>);
```
Full statement stored as `rollback_sql` in `scripts/staging/backups/inserted_ids_20260716.json`.

## 6. Hand-off checklist for Chace
- [ ] Review branch `consolidate-athletes-canonical` (code repoint in `lib/swimcloud.ts`, `components/TopPerformersStrip.tsx`, `lib/supabase/types.ts`; plus these notes + backups/manifest under scripts/staging/).
- [ ] Run the app locally and smoke-test the four read paths: an athlete detail page's Best Times/Recent Meets (e.g. a Texas or Cal swimmer), a meet's By-Event and By-Team views, and Top Performers across a few events. (Build/typecheck/lint already pass; `next build` needs a Mac due to the lightningcss native binary — see §4e.)
- [ ] `git push` the branch (nothing was committed or pushed by this run). The migration `20260716174347` is already applied to the remote DB.
- [ ] **Before dropping `swim_athletes`** (do only after burn-in): eliminate the fallback so nothing orphans —
  1. ~~Add the 23 swim-only teams to `teams`, import the **39** deferred athletes~~ **DONE in §7** (2026-07-16). Net-new orphans are now **1** (down from 40): only Derek Colbert/Missouri's second SwimCloud id `1445080`.
  2. Resolve the last orphan (see §7c) — **DONE 2026-07-17 (§8):** merged Derek's duplicate id `1445080 → 1427843` at the DB level (4 `swim_individual_results` rows; manifest `backups/derek_colbert_merge_20260717.json`). Orphans now **0**.
  3. ~~delete the `swim_athletes` fallback + name-match bridge~~ — **DONE 2026-07-17 (§8):** fallback + bridge removed from `lib/swimcloud.ts` and `components/TopPerformersStrip.tsx`; `swim_athletes` is now functionally unreferenced in app code (only a provenance comment remains on `athletes.swimcloud_id` in `lib/supabase/types.ts`). **Remaining: `DROP TABLE swim_athletes` after burn-in.**

---

## 7. Phase 2 — 23 teams + 39 deferred athletes inserted; `swim_athletes` now one orphan from retireable (2026-07-16)

Continuation on branch `consolidate-athletes-canonical`. Additive/reversible only: INSERTs into `teams` and `athletes`; **zero writes to `swim_athletes`**; no DROP/RENAME/TRUNCATE/DELETE, no commit/push, no deploy. Clears 39 of the 40 net-new repoint orphans from §4c.

Pre-write state verified clean: teams=53, athletes=1905 (980 w/ swimcloud_id), swim_athletes=1043, swim_teams=76.

### 7a. 23 teams inserted (additive)
The 23 swim-only teams (the deferred set from §3) added to `teams`. `teams`: 53 → **76** (verified +23; all 23 present).
- Manifest / rollback: `scripts/staging/backups/inserted_team_ids_20260716.json` (23 uuids + `rollback_sql`).
- `id` = new uuid4 (`teams.id` is uuid; `swim_teams.id` is a text slug, retained in the manifest `rows[]` for traceability).
- `conference` mapped to the canonical `teams` code convention **the home page groups by**: `acc`, `big-12`, `patriot` kept as-is (Miami-FL, Brigham Young, Loyola); **all other swim conferences bucketed to `other`** (matching the existing 53-team pattern where non-power confs are `other`). `conference_display_name` (NOT NULL, no default) supplied with the full name (Mountain West, Big West, Western Athletic, Atlantic 10, Conference USA, Colonial Athletic, American Athletic, Big East, Missouri Valley, Horizon League, Mid-American, Summit League).
- `primary_color`/`secondary_color`/`athlete_count`/timestamps = column defaults.

### 7b. 39 deferred athletes inserted (additive)
The 39 swim-only roster rows on those 23 teams inserted into `athletes`. `athletes`: 1,905 → **1,944** (+39 exactly). `swim_athletes` unchanged at **1,043**. Rows carrying a swimcloud_id: 980 → **1,019**. `athletes` with NULL team_id = **0** (integrity preserved). All 39 verified with both team_id and swimcloud_id set.
- Manifest / rollback: `scripts/staging/backups/inserted_athletes_phase2_20260716.json` (39 ids + `rollback_sql`).
- `id` preserved from `swim_athletes.id` (0 PK collisions verified). `team_id` resolved by `teams.name = swim_teams.name` for the 23 phase-2 teams. Column mapping identical to §3 (`headshot_url→photo_url`, `roster_url→profile_url`, `year→class_year` via CASE, `athlete_type` via `lower()`, `status→is_archived`, `swimcloud_id→swimcloud_id`). All 39 source rows had NULL `year`/`athlete_type` and `status='active'` → `class_year` NULL, `athlete_type` NULL, `is_archived` false (all CHECK-safe).
- Side effect (expected, benign): `athletes_count_trigger` bumped `teams.athlete_count` for the 23 teams (sum = 39); reverses on the rollback DELETE.

### 7c. Derek Colbert / Missouri — LEFT UNCHANGED (documented)
The +1 orphan artifact from §4b. `swim_athletes` holds two Derek Colbert/Missouri rows: swimcloud_id `1427843` and `1445080`. The canonical `athletes` row (`06b29d8d…`) already carries `1427843` (the §4b lexical winner). **Both** ids are referenced in `swim_individual_results` (`1427843` → 1 row, `1445080` → 4 rows). Setting the athletes row's swimcloud_id to `1445080` would resolve that orphan **but newly orphan `1427843`** (it is in results *and* in swim_athletes) — it does not cleanly resolve without creating a new orphan. Per scope ("UPDATE … only if it cleanly resolves that orphan"), **no write was made to Derek's row.** He is a genuine SwimCloud duplicate (two profiles, one swimmer) that a single-value `swimcloud_id` column cannot fully reconcile.

### 7d. Orphan re-check (read-only, vs `swim_individual_results`) — 40 → 1
Net-new repoint orphans (result-referenced swimcloud_ids resolvable via `swim_athletes` but **not** `athletes`): **1** — namely `1445080` (Derek Colbert). The 39 phase-2 inserts cleared the other 39.

Because orphans are **> 0**, the `swim_athletes` fallback + name-match photo bridge in `lib/swimcloud.ts` and `components/TopPerformersStrip.tsx` were **KEPT (not removed)** so `1445080`'s 4 result rows still resolve — zero display regression. `swim_athletes` therefore **remains code-referenced** (retirement is one Derek-Colbert decision away; see §6).

> **[SUPERSEDED 2026-07-17 — see §8]** Derek's `1445080` was merged into `1427843` at the DB level, dropping orphans to **0**; the `swim_athletes` fallback + name-match bridge have now been removed and the table is code-unreferenced.

### 7e. Home page
Expands **53 → 76** teams as expected: `app/page.tsx` fetches `teams` filtered `athlete_count > 0`, and the trigger populated the 23 new teams' counts in 7b.

### 7f. Verification
- `npx tsc --noEmit` → **clean (exit 0)**. `eslint lib/swimcloud.ts components/TopPerformersStrip.tsx lib/supabase/types.ts` → **clean (exit 0)**. No code files were changed in phase 2 — the branch's three code edits from §4d are untouched.
- `next build` still not runnable in the Linux sandbox (lightningcss native-binary mismatch, §4e) — environmental, unrelated; builds on Chace's Mac.

### 7g. Rollback (phase 2 — additive, independent of §3/§4/§5)
Undo without touching `swim_athletes`. Deleting the 23 teams CASCADEs (`athletes_team_id_fkey ON DELETE CASCADE`) to the 39 phase-2 athletes and the trigger reverses `athlete_count`:
```sql
-- inserted_team_ids_20260716.json → rollback_sql (also removes the 39 phase-2 athletes via CASCADE):
DELETE FROM public.teams WHERE id IN (<23 ids>);
```
Or delete the athletes first, then the teams:
```sql
-- inserted_athletes_phase2_20260716.json → rollback_sql:
DELETE FROM public.athletes WHERE id IN (<39 ids>);
DELETE FROM public.teams WHERE id IN (<23 ids>);
```
Full `rollback_sql` is stored in each manifest. The §3 (28-row) and §4 (swimcloud_id) rollbacks are unchanged.
- [ ] Optional: also port `logo_fallback_url` + `conference_display_name` before retiring `teams` (separate from `swim_athletes`; see CONSOLIDATION-READY.md §4.6).

---

## 8. Phase 3 — Derek Colbert merged, orphans 0, fallback + bridge removed; `swim_athletes` code-unreferenced (2026-07-17)

Continuation on branch `consolidate-athletes-canonical`. Clears the final blocker from §7c/§7d and removes the retained `swim_athletes` fallback so the table is now retireable. **This code-cleanup pass made zero DB writes** (no DML/DDL, no writes to `swim_athletes`, no drop/alter); the enabling merge in 8a was applied separately at the DB level.

### 8a. Final orphan cleared — Derek Colbert / Missouri merge (DB-level)
The lone net-new orphan from §7d (`1445080`) was resolved by merging Derek's duplicate SwimCloud profile into his canonical id. His 4 `swim_individual_results` rows were repointed `1445080 → 1427843` (the id the canonical `athletes` row `06b29d8d…` already carries), so all 5 of his results now resolve via `athletes.swimcloud_id`.
- Manifest / rollback: `scripts/staging/backups/derek_colbert_merge_20260717.json` (4 row ids `[146261, 112247, 112730, 137485]` + `rollback_sql`).
- Verified `1445080` appeared **only** in `swim_individual_results` — not in `swim_diving_results`, `swim_relay_results` (legs 1–4), `csd_athletes`, or favorites — and the repoint hit no `(meet_id, event_id, athlete_id)` unique-key collision.
- `swim_athletes` still holds both Derek rows (`1427843`, `1445080`); left untouched — they drop with the table.

### 8b. Orphan re-check (read-only) — now 0
Every `athlete_id` referenced by `swim_individual_results`, `swim_diving_results`, and `swim_relay_results` (all four relay legs) now resolves via `athletes.swimcloud_id`. **Retirement-blocking orphans = 0** (was 1 in §7d, 40 in §4c). Removing the fallback therefore causes no display regression.

### 8c. Fallback + name-match bridge removed (code)
With orphans at 0, the `swim_athletes` fallback + name-match photo bridge that §4d/§7d had **KEPT** were removed. Clean `athletes`-primary (by `swimcloud_id`) reads remain; behavior is identical for the resolvable set (now everything).
- `lib/swimcloud.ts` — `findSwimcloudId`: dropped the `swim_athletes` last-name/slug fallback (now `athletes` name + `teams.name` only). `loadMeetRows`: dropped the `swim_athletes` fallback for unresolved result ids; any unmatched id falls through to the existing `Athlete #id` render (unreachable for the tracked set now). Also trimmed the stale `swim_athletes` mention in the `TEAM_SLUG_OVERRIDES` comment to `swim_teams`.
- `components/TopPerformersStrip.tsx` — universe now reads only `athletes.swimcloud_id` (dropped the `swim_athletes` union); removed the entire `swim_athletes` fallback block including the name-match photo/profile bridge to `athletes` and the now-unused `slugToDisplayName` helper.

### 8d. `swim_athletes` now unreferenced in app code
Grep of the app tree (`app/`, `components/`, `lib/`, `hooks/`) for `swim_athletes` / `from('swim_athletes')` / `swimAthletes`:
- **No functional references remain.** `lib/swimcloud.ts` and `components/TopPerformersStrip.tsx` are token-free.
- The only remaining app-tree mention is a **provenance comment** on `athletes.swimcloud_id` in `lib/supabase/types.ts` ("Backfilled from swim_athletes …") — documentation only; it does not read or type the table and does not block a DROP.
- Archived / staging one-offs under `scripts/` and `archive/scripts/` (plus `docs/plans/`, `CLAUDE.md`) retain historical references — intentionally left as-is.

### 8e. Verification
- `npx tsc --noEmit` → **clean (exit 0)**.
- `eslint lib/swimcloud.ts components/TopPerformersStrip.tsx` → **clean (exit 0)**.
- `next build` still not runnable in the Linux sandbox (lightningcss native-binary mismatch, §4e) — environmental, unrelated; builds on Chace's Mac.

### 8f. Status — `swim_athletes` is now safe to DROP after burn-in
The table is functionally code-unreferenced and every result id resolves via `athletes`. Remaining hand-off: `git push` the branch, smoke-test, then after a burn-in window `DROP TABLE swim_athletes`. No separate rollback data is needed for this code pass — revert the branch commit to restore the fallback; the Derek merge reverses via its manifest `rollback_sql`.
