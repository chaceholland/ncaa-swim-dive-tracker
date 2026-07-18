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

---

## 9. Phase 4 — key hygiene + token-guarded headshot endpoint (2026-07-17)

Continuation on branch `consolidate-athletes-canonical`. **Code only: zero DB writes, zero DDL, no drops, no push, no deploy.** Triggered by investigating why the CSD Chrome extension stopped saving headshots.

### 9a. The extension had been a silent no-op since 2026-03-04 — NOT caused by the consolidation

`csd-headshot-extension/background.js` PATCHed `https://<project>.supabase.co/rest/v1/csd_athletes?...` with the **anon** key. Three facts stack up:

1. `csd_athletes` is a legacy **view over `swim_athletes`** created with `security_invoker=true`, so it enforces the *caller's* RLS — i.e. anon's.
2. Anon has **SELECT only**. The UPDATE therefore matched **0 rows**.
3. PostgREST returns **204 No Content** for an UPDATE that matches 0 rows, and `background.js:166` checked only `response.ok` — so the extension logged `SUCCESS: <athlete name>` for every single athlete while writing nothing.

The breakage dates to **2026-03-04**, months before this consolidation work began (2026-07-16). The consolidation did not cause it and did not make it worse; it only surfaced it. Note the extension was also writing the wrong column name (`headshot`) and the wrong id space (`team_id=eq.<text slug>` against a uuid column) — it could not have worked even with permission.

### 9b. Why we did NOT just open an anon UPDATE policy

The one-line "fix" would be an RLS policy granting anon UPDATE on `athletes`/`csd_athletes`. We deliberately rejected it:

- It would put a **public, unauthenticated write grant** on the canonical roster table. The anon key ships inside a Chrome extension and in every browser bundle — it is not a credential.
- It would **arm `npm run upgrade-images`** (`scripts/upgrade-image-quality.ts`), which is currently inert. That script does an unconditional regex rewrite of *every* non-null `photo_url` (`width=\d+`→`width=800`, `height=\d+`→`height=800`) with no dry-run, no backup and no undo — a mass rewrite across roughly **1,514 `photo_url` values**. Today it fails safe because anon can't write. An anon UPDATE policy would silently convert that script from a no-op into a one-command, irreversible bulk mutation of the photo set.
- Any anon-writable path is also writable by anyone who reads the key, i.e. anyone.

Instead the write capability was moved server-side behind a shared secret (9d), which is strictly narrower: one endpoint, one column, one team at a time.

### 9c. Task A — key hygiene (no behavior change; all four paths were already inert under RLS)

New shared helper **`scripts/lib/supabase-admin.ts`**: loads `.env.local` via `dotenv` (matching the `scripts/staging/*.mjs` convention) and exports `createAdminClient()`, which builds a `SUPABASE_SERVICE_ROLE_KEY` client and **throws loudly** if the URL or key is missing. It never falls back to anon — a crash beats a silent no-op. The JWT is read from env, never hardcoded (unlike `scripts/update-missing-data.ts`, which still has a literal service-role JWT in source — flagged below, left untouched as out of scope).

Repointed from `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `createAdminClient()`:
- `scripts/upgrade-image-quality.ts` (UPDATE `photo_url`) — see the 9b caveat: this is now *armed*. Treat it as a destructive bulk operation and back up `photo_url` before running it.
- `scripts/scrape-athletes.ts` (INSERT `athletes`)
- `scripts/scrape-athletes-v2.ts` (INSERT `athletes`)
- `scripts/rescrape-teams.ts` (INSERT `athletes`)

`app/api/update/route.ts` — removed the silent anon fallback in `getSupabase()`. Was `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY`; now service-role only, throwing a distinct error per missing variable. Previously a Vercel deploy missing `SUPABASE_SERVICE_ROLE_KEY` would degrade to an anon client and report a successful cron run that wrote nothing — the same failure mode as the extension.

### 9d. Task B — token-guarded headshot endpoint + extension repoint

New route **`app/api/headshots/route.ts`**:

| | |
|---|---|
| Method / path | `POST /api/headshots` (plus `OPTIONS` for the extension's CORS preflight) |
| Auth | `Authorization: Bearer <HEADSHOT_SECRET>` — same shape as the `CRON_SECRET` check in `app/api/update/route.ts:388`. **Mandatory**, unlike CRON_SECRET's `if (secret)` pattern: if `HEADSHOT_SECRET` is unset the route returns **503**, so it can never sit open. Mismatch → **401**. The secret is never logged or echoed. |
| Body | `{ "team": "<slug>", "updates": [{ "name": "...", "photo_url": "https://..." }] }` — batched per team (max 500 per request); items with a blank name or a non-`http(s)` URL are skipped and counted as `skippedInvalid`. |
| Team resolution | Server-side only. Loads `teams`, indexes it with the shared `teamNameToSlug` + `TEAM_SLUG_OVERRIDES` logic, and resolves the posted slug → `teams.id` uuid. Unknown slug → **404** with the slug echoed back. |
| Write | `athletes.photo_url` (+ `updated_at`), matched on `team_id` + `name`, using the **service-role** client. Exact name match first, then a case-insensitive exact match (`ilike`, wildcards escaped) as a fallback — no fuzzy matching. |
| Response | `{ team, teamId, teamName, received, skippedInvalid, matched, updated, unmatched: [names], errors: [{name, error}] }`. Counts come from `.select()` on the UPDATE, so they are **actual affected rows** — the truthfulness that was missing before. |

Supporting extraction: **`lib/teamSlug.ts`** (new) now owns `TEAM_SLUG_OVERRIDES`, `teamNameToSlug` and a `naiveTeamSlug` helper; `lib/swimcloud.ts` imports and re-exports `teamNameToSlug` so its callers (`components/TopPerformersStrip.tsx`) are unchanged. The extraction exists because `lib/swimcloud.ts` instantiates an **anon browser client at module load** — importing it from a service-role route would both pull that client into a server bundle and make the route crash on import if the `NEXT_PUBLIC_*` vars were absent. Single source of truth is preserved; nothing is duplicated.

**Slug alias (bug found while wiring this up):** the extension's team ids predate `TEAM_SLUG_OVERRIDES`. It sends `virginia`, but `teamNameToSlug("Virginia")` returns `uva` — a straight slug map would 404 that team. The index therefore also registers the naive (pre-override) slug as an alias, without ever clobbering a canonical slug claimed by another team. Both `virginia`/`uva` and `texas-am`/`texas-a-m` resolve.

`csd-headshot-extension/background.js` (that file only; `background.js.backup` and `background-lsu-fix.js` untouched):
- Dropped the hardcoded `SUPABASE_URL` / anon `SUPABASE_KEY`; added `API_BASE_URL = 'https://ncaa-swim-dive-tracker.vercel.app'` and `HEADSHOTS_ENDPOINT`.
- Secret read via `getHeadshotSecret()` → `chrome.storage.local.get('headshotSecret')`, with an empty, clearly-commented `HEADSHOT_SECRET_FALLBACK = ''` placeholder. **No secret value is committed.** If no secret is present the run still scrapes but logs a loud `NO SECRET CONFIGURED` and uploads nothing.
- The per-athlete PATCH loop became **one batched POST per team**.
- Logging now reports the endpoint's real numbers — `Sent N of M | matched X | updated Y`, a `NO DB MATCH (n): name, name…` warning listing every unmatched athlete, row-level errors, and an explicit `WARNING: 0 rows updated` line. The old unconditional per-athlete `SUCCESS:` log is gone.
- The route returns permissive CORS headers (`Access-Control-Allow-Origin: *`) and handles `OPTIONS`, because `manifest.json` `host_permissions` covers only `*.com` / `*.net` / `*.edu` — not `*.app`. This keeps the fix inside `background.js` as scoped. Allowing any origin is safe here: every request still needs the bearer secret and no credentials are involved. (Optional later cleanup: add `https://ncaa-swim-dive-tracker.vercel.app/*` to `host_permissions` and tighten the CORS origin.)

### 9e. Env vars Chace must set

| Variable | Where | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel project env **and** `.env.local` | Already in `.env.local`. **Confirm it is set in Vercel** — with the fallback removed, `/api/update` now fails fast instead of pretending to succeed. |
| `HEADSHOT_SECRET` | Vercel project env **and** `.env.local` | New. Generate with `openssl rand -hex 32`. Redeploy after adding. Until it is set, `/api/headshots` returns 503 by design. |

Both are documented in `.env.local.example` (updated this pass). `.env*` is gitignored — no secret is committed.

### 9f. Loading the secret into the extension

1. `chrome://extensions` → CSD Roster Headshot Scraper → **service worker** ("Inspect views") to open its DevTools console.
2. Run, with the same value set in Vercel:
   ```js
   chrome.storage.local.set({ headshotSecret: 'PASTE_HEADSHOT_SECRET_HERE' })
   ```
3. Verify: `chrome.storage.local.get('headshotSecret').then(console.log)`
4. Reload the extension and run a scrape. The console should print real `matched`/`updated` counts. Storage persists across reloads; re-run step 2 only if the extension is removed and re-added, or the secret is rotated.

To clear it: `chrome.storage.local.remove('headshotSecret')`.

### 9g. Verification
- `npx tsc --noEmit` → **clean (exit 0)**.
- `eslint` on all changed + new files → **no new problems**. Byte-for-byte against a HEAD baseline of the same files: 24 errors / 6 warnings before, 24 errors / 6 warnings after (all pre-existing `no-explicit-any` / `prefer-const` / `ban-ts-comment` in the legacy scraper scripts; only their line numbers shifted). Every file authored this pass — `app/api/headshots/route.ts`, `lib/teamSlug.ts`, `scripts/lib/supabase-admin.ts`, `csd-headshot-extension/background.js` — is eslint-clean.
- `node --check csd-headshot-extension/background.js` → OK.
- **No live call to `/api/headshots`** — it is not deployed and the secret does not exist yet.
- `next build` still not runnable in the Linux sandbox (lightningcss native-binary mismatch, §4e) — environmental; builds on Chace's Mac.

### 9h. Still pending — Chace-run, now verified safe
```sql
DROP VIEW public.csd_athletes;
DROP TABLE public.swim_athletes;
```
§8d established `swim_athletes` is code-unreferenced and §8b that orphans are 0. This pass adds the last missing piece: **the extension never actually wrote through `csd_athletes`** (9a) — every PATCH matched 0 rows for four months — so dropping the view destroys no write path and loses no data that was ever persisted. The extension no longer references the view at all after 9d. Drop the view before the table (the view depends on it).

### 9i. Follow-ups (not done — out of scope)
- `scripts/update-missing-data.ts:4-6` still contains a **hardcoded service-role JWT** in committed source. It was outside this pass's four-file scope, but that key is in git history and should be rotated, then the script switched to `createAdminClient()`. Rotating it means updating `SUPABASE_SERVICE_ROLE_KEY` in Vercel and `.env.local` at the same time.
- `scripts/upgrade-image-quality.ts` is now armed (9c). Add a `--dry-run` flag and a `photo_url` backup before it is ever run.
- Extension `manifest.json` still lacks a `host_permissions` entry for the tracker origin; the route's CORS headers cover it for now.

## 10. Phase 5 — service-role key purged from the working tree (2026-07-18)

Closes the first bullet of §9i, and it was worse than that bullet described: `scripts/update-missing-data.ts` was not the only file. A repo-wide scan for the JWT header prefix found the **same service-role key hardcoded in 9 tracked files**.

### 10a. Treat the key as burned — rotate it

**This repo is public on GitHub.** The service-role JWT was committed in plaintext, so it must be assumed compromised by anyone who cloned, forked, or scraped the repo, or read it through the GitHub API. Service-role bypasses RLS entirely — it is full read/write on every table.

**Chace must rotate `SUPABASE_SERVICE_ROLE_KEY` in the Supabase dashboard**, then update it in both places at once (per §9e):
- Vercel project env
- local `.env.local`

Rotation is the *only* fix that actually revokes the exposed key. Everything below is cleanup, not remediation — it stops the key being re-leaked going forward, it does not un-leak it.

### 10b. Git history still contains the old key — that is expected

Removing the literal from the working tree does **not** remove it from git history. Commit `bab1e06` and its ancestors still contain the key, and it remains reachable on the public remote.

We deliberately did **not** rewrite history (`filter-repo` / `filter-branch` / force-push). On a published public repo a rewrite breaks every clone and fork, and it still cannot claw back a key that has already been fetched or cached by GitHub. **Rotation is the fix; history rewriting would be theater.** Once the key is rotated, the copy in history is a dead credential and harmless.

### 10c. Files changed (9)

| File | Change |
|---|---|
| `scripts/update-missing-data.ts` | Now uses `createAdminClient()` from `scripts/lib/supabase-admin.ts`, matching the four scripts converted in `bab1e06`. Dropped the local `createClient` / `supabaseUrl` / `supabaseKey` block. |
| `check-teams.js` (repo root) | Literal → `process.env.SUPABASE_SERVICE_ROLE_KEY`, throws if unset. |
| `archive/scripts/lightweight-scraper.js` | Same. |
| `archive/scripts/manual-photo-batch-update.js` | Same. |
| `archive/scripts/scrape-retry.js` | Same. |
| `archive/scripts/scrape-update.js` | Same. |
| `archive/scripts/simple-photo-updater.js` | Same. |
| `archive/scripts/test-scrape.js` | Same. |
| `archive/scripts/update-missing-data.js` | Same. |

The eight plain-`.js` one-offs are not TS-compiled and none of them loaded dotenv, so they got the minimal fail-fast form rather than the `createAdminClient()` helper (which is TS-only):

```js
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — export it or add it to .env.local');
}
```

Run them the way the other archive scripts document it: `node --env-file=.env.local <script>`. No files were deleted.

### 10d. The working tree is now clean of service-role literals

`git grep` for the Supabase JWT header prefix (`eyJhbGciOi…`, the base64 of `{"alg":"HS256","typ":"JWT"}`) returns **one** hit, and it is not a secret:

- `csd-headshot-extension/background.js.backup:5` — this is the **anon** key (`"role": "anon"` in the decoded payload), not service-role. Anon keys are public by design; they ship in browser bundles and are RLS-constrained. Left in place deliberately.

Every service-role occurrence is gone. Note that anon and service-role keys share that identical JWT header prefix, so grepping for it alone cannot tell them apart — **decode the payload and check the `role` claim** before assuming a hit is a leak.

(The full prefix is deliberately not written out anywhere in this file, so that a repo-wide grep for it stays clean and these notes do not become a false positive.)

No new-format keys (`sb_secret_…` / `sb_publishable_…`) appear anywhere in the tree, and no `.env*` file is tracked except `.env.local.example`.

### 10e. Verification
- `git grep` for the JWT header prefix → only the anon key in `background.js.backup` (10d); **zero service-role literals**.
- `npx tsc --noEmit` → **clean (exit 0)**.
- `eslint` on all 9 changed files, against a HEAD baseline of the same files: **28 problems (19 errors, 9 warnings) before, 28 after** — identical. All pre-existing `no-require-imports` / `no-explicit-any` / `no-unused-vars` in the legacy scripts. No new problems introduced.
- No DB writes, no network calls, nothing pushed.

### 10f. Guardrail worth adding (not done)
Nothing currently stops the next hardcoded key from landing. Consider a pre-commit hook or CI step that greps staged content for the JWT header prefix and fails on any hit whose decoded `role` is `service_role`.

## 11. Phase 6 — headshot scraper scoped to the men's roster (2026-07-18)

Branch `fix-mens-roster-scope`. Fixes wrong-gender headshots at the source. **Code only — this pass does not correct a single photo already in the bucket. See §11f.**

### 11a. The finding — women's photos on men's athletes

A spot-check of **56 headshots across 22 schools** turned up:

| Defect | Count | Rate |
|---|---|---|
| **Wrong gender** (a woman's photo on a men's-roster athlete) | **2** | **3.6%** |
| Not a headshot (distant / full-body action shots — all Georgia Tech) | 3 | 5.4% |
| Team-logo placeholder instead of a person (Missouri) | 1 | 1.8% |

The two confirmed gender mismatches:

- `athlete-headshots/auburn/danny-schmidt.jpg` — a **female** athlete. Auburn's combined roster page carries a **"Hanna Schmidt"** on the women's side. Same surname, so the name-matching upload picked the wrong card.
- `athlete-headshots/north-carolina/tom-mienis.webp` — a **female** athlete in UNC gear.

Only the wrong-gender class is addressed here. The Georgia Tech action shots and the Missouri logo placeholder are separate defects and are **not** fixed by this pass (§11g).

### 11b. Root cause — the scraper read whole combined pages

`csd-headshot-extension/background.js` injected `extractAthletes()` into each roster URL and ran its card selectors against **`document`** — the entire page.

Many school roster pages are **combined**. `auburntigers.com/sports/swimming-diving/roster` renders, in one document:

```
## Women's Roster
## Men's Roster
## Swimming & Diving Coaching Staff
## Support Staff
```

So `document.querySelectorAll('.sidearm-roster-player')` returned the women's cards, the men's cards, and often the staff cards, in one flat list. Every one of them was uploaded as a men's athlete. The endpoint then matched on name, and a shared surname (Schmidt) was enough to land a woman's photo on a man's row.

**The URL path is not a reliable signal, and that is the important part.** Of the 51 configured teams, 39 use a men-specific path (`/mens-swimming-and-diving/`, `/mswim/`) and 12 use a non-gendered one:

> Alabama, Auburn, Georgia, LSU, South Carolina, Texas A&M, Florida State, Georgia Tech, NC State, Pittsburgh, Utah, West Virginia

But **North Carolina's bad photo came from `goheels.com/sports/mens-swimming-and-diving/roster`** — a men-specific URL that still serves combined markup. A URL allow-list would therefore have missed it. The fix has to detect the page structure **at runtime**, which is what it now does.

### 11c. What changed — `csd-headshot-extension/background.js` (only file)

Detection runs inside the injected `extractAthletes()` (it is stringified by `chrome.scripting`, so every helper had to be declared inside it — nothing can be hoisted to the service-worker scope).

1. **Classify section headings.** Scan `h1-h4` plus `[class*="section-title"]` / `[class*="sectionTitle"]` / `[class*="section_title"]` / `[class*="roster-title"]` / `[class*="rosterTitle"]`, skipping anything inside `nav`/`select`/`option` and any text over 120 chars. Normalize curly apostrophes (`’` → `'`) and collapse whitespace, then tag each heading `men` / `women` / `staff`.

   The men's pattern is `/\bmen'?s[\s\S]{0,40}?\brosters?\b/i`. **The leading `\b` is what stops it matching the tail of "women's roster"** — `o` and `m` are both word characters, so there is no boundary there. A single heading that matches *both* patterns (`"Men's & Women's Roster"`) is deliberately left unclassified: it is one undivided list, not a boundary, so the page falls back to whole-page mode rather than being filtered to zero.

2. **Scope to the men's subtree, but only if both genders are present.** If the page has a men's heading **and** a women's heading, pick a search root:
   - *Containing section* — climb from the men's heading to the widest ancestor that still excludes every women's/staff heading. Handles nested `<section>` and tab-pane markup.
   - *Sibling walk* — if that ancestor holds no cards (flat markup), walk `nextElementSibling` from the heading until a women's/staff heading, or any heading of the same-or-higher level, ends the section. This is what stops "Swimming & Diving Coaching Staff" being swept in.

   A candidate is only accepted if it actually contains cards, tested against a probe selector that unions every per-site selector (`.sidearm-roster-player, .roster-card, li[class*="roster"], .s-person-card, a[href*="/roster/player/"], .sqs-row`). If no candidate works, it falls back to whole-page.

3. **Fall back to whole-page when there is only one roster section, or none.** Unchanged behavior for the 39 men's-only pages that were already correct.

4. **Safety net (independent of scoping).** On combined pages only, every card is rejected if either:
   - the nearest **preceding** gendered heading in document order is the women's one (via `compareDocumentPosition`), or
   - any ancestor within 12 levels has an `id`/`class` matching `/wom[ae]n/i` (SIDEARM tab panes such as `#women-roster`).

   Gating this on "combined page" is what makes it safe: a men's-only URL can never be filtered down to zero by it.

5. **Per-team audit logging.** Each team now prints which mode it used and what it caught:

   ```
     SCOPE: men's section scoped (sibling walk) via "Men's Roster"
     Roster headings - mens: 1, womens: 1
     Cards in scope: 27 | skipped as womens-roster: 0
   ```

   The pre-existing selector counts above these lines are still **whole-page** counts, on purpose — the two sets side by side are what make a run auditable. A combined page that falls back to whole-page mode emits a `console.warn` naming itself for follow-up.

**Unchanged:** the batched `POST /api/headshots`, the `Authorization: Bearer` secret from `chrome.storage.local`, and all §9d upload logging. `background.js.backup` and `background-lsu-fix.js` were not touched. The diff is 238 insertions / 20 deletions in one file (10 of those deletions are trailing-whitespace churn on adjacent lines).

### 11d. Verification

Chromium could not launch in the Linux sandbox (missing host libraries), so the injected function was exercised against **jsdom** instead — the real DOM APIs it depends on (`querySelectorAll`, `closest`, `contains`, `compareDocumentPosition`, `matches`) all behave identically there.

`extractAthletes()` was sliced out of `background.js` verbatim and run against 11 synthetic roster pages, each seeded with 3 men, 2 women (including the **Schmidt surname collision**), and — where the shape called for it — coaching/support staff cards. **All 11 pass — 3/3 men kept, 0 women, 0 staff, in every case:**

| Case | Result |
|---|---|
| Flat combined, women → men → coaching staff → support staff (Auburn shape) | scoped, *sibling walk* |
| Nested `<section>` blocks | scoped, *containing section* |
| Men's-only, no gendered headings | whole page (fallback, correct) |
| Reversed order — men's section first | scoped, *sibling walk* |
| Ambiguous `"Men's & Women's Roster"` | whole page, **no filtering** (correct) |
| `div.section-title` instead of `h*` tags | scoped, *sibling walk* |
| Tab panes (`#women-roster` / `#mens-roster`) | scoped, *containing section* |
| Men's section between staff and women's | scoped, *sibling walk* |
| Men's heading present, no women's section | whole page (fallback, correct) |
| **Scoping deliberately broken** (men's heading is a dead end) | whole page + **safety net removed 2 women** |
| **Women's cards after the men's heading**, inside a women-labelled container | scoped + **safety net removed 2 women** |

The last two matter most: they are the cases where scoping fails and the net is the only thing standing between a women's photo and the bucket. Both hold.

- `node --check csd-headshot-extension/background.js` → **OK**.
- `eslint csd-headshot-extension/background.js` → **clean (exit 0)**; the HEAD baseline of the same file was also clean, so **no new problems**.
- `npx tsc --noEmit` → **clean (exit 0)**. (`background.js` is browser-only and not in the TS program; this only confirms nothing else regressed.)
- **No DB reads or writes. No live scrape. Nothing pushed.**

### 11e. What this pass does NOT do

The extension is fixed. **The bucket is not.** Every wrong photo scraped before today is still attached to its athlete. The fix only changes what the *next* run collects.

### 11f. Chace must re-scrape before the October season

Scale of the correction, from the local `scripts/staging/backups/athletes_backup_20260716.json` snapshot (no live DB read this pass): **1,509 of 1,877 athletes have a populated `photo_url`**. At the sampled 3.6% mismatch rate that is a point estimate of **≈ 54 wrong-gender photos**, and because the sample was only 56 photos the honest range is roughly **20-170**. Mismatches also cluster — they need a surname collision across the two rosters — so the true figure depends on how many combined pages have one.

To actually correct them:

1. Set `HEADSHOT_SECRET` in the Vercel project env and `.env.local` (§9e), and redeploy. Until it is set, `/api/headshots` returns 503 by design.
2. Load the secret into the extension (§9f): `chrome://extensions` → CSD Roster Headshot Scraper → **service worker** → `chrome.storage.local.set({ headshotSecret: '...' })`.
3. Load/reload the unpacked extension from `csd-headshot-extension/` so the new `background.js` is live.
4. Run the scrape from the popup, and **watch the service-worker console**. Confirm per team:
   - the 12 non-gendered URLs in §11b report `SCOPE: men's section scoped`;
   - `Cards in scope` is roughly half the whole-page `.sidearm-roster-player` count on those pages — that halving is the fix working;
   - no team logs the `Combined page but scoping fell back to whole page` warning. Any team that does needs its markup looked at by hand.
5. Re-check the two known-bad athletes afterwards: Auburn **Danny Schmidt**, North Carolina **Tom Mienis**.

Re-scraping overwrites `photo_url` in place, so it self-heals every row it can match — but only for athletes still on a current roster page. **Anyone who has since graduated keeps their bad photo and needs a manual fix.**

### 11g. Follow-ups (not done — out of scope)

- **Georgia Tech** returns distant/full-body action shots rather than headshots (3 of 3 sampled). Likely a different image field on `ramblinwreck.com`; needs a per-site handler like Kentucky's and LSU's.
- **Missouri** returns a team-logo placeholder. The `bad` substring filter (`placeholder`, `default`, `silhouette`, `avatar`, `blank`) does not catch it — the URL looks like a normal asset.
- No automated check exists that a stored headshot depicts the right person. A cheap partial guard: have `/api/headshots` reject an update whose `photo_url` filename slug does not share a token with the athlete's name.
- The 3.6% figure comes from a 56-photo sample, not an audit. A full pass over all 1,509 photos is the only way to actually bound this.

---

## 12. Phase 7 — env var name mismatch resolved via alias; branches consolidated onto `main` (2026-07-18)

### 12a. The mismatch — §9/§10 would have broken the next deploy

Vercel carries **`SUPABASE_SECRET_KEY`** (Preview + Production, added 2026-06-03). It does **not** carry `SUPABASE_SERVICE_ROLE_KEY`.

§9c and §10c standardized the code on `SUPABASE_SERVICE_ROLE_KEY` *and removed the silent anon fallback* — deliberately, so a missing key fails loudly instead of writing 0 rows. Correct call, wrong variable name. Combined, the next redeploy would have thrown on every privileged path: `/api/update` (the roster cron) and `/api/headshots` at first request, and every converted `scripts/` tool at startup. The §9e table's instruction to "confirm `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel" was unactionable as written — the variable there has always had the other name.

Note the two names are also different *formats* now: Chace's project issues the new `sb_secret_…` style, and legacy service-role JWTs were disabled 2026-04-22. Any `eyJ…` value still lying around is dead regardless of which name it sits under.

### 12b. Resolution — accept either name for the same key

Both names now resolve to one privileged credential:

```ts
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
```

`SUPABASE_SECRET_KEY` is primary; `SUPABASE_SERVICE_ROLE_KEY` is a legacy alias kept so older checkouts and CI keep working. If neither is set, the error names **both**.

Two things this is explicitly **not**:
- **Not a reintroduction of the anon fallback.** These are two names for the same privileged key. There is still no path from a missing secret to an anon/publishable client — §9b's reasoning stands unchanged, and the missing-key case still throws.
- **Not `??`.** `||` is used on purpose: a variable that exists but is set to `""` (easy to do in the Vercel UI) falls through to the alias instead of resolving to an empty key.

### 12c. Files changed (13)

| File | Change |
|---|---|
| `scripts/lib/supabase-admin.ts` | Alias logic + both-names error message. **The only place the five `scripts/*.ts` tools needed it** — they all call `createAdminClient()`, so they inherit it with no edit. |
| `app/api/update/route.ts`, `app/api/headshots/route.ts` | Alias logic inline (each builds its own client); both-names error. |
| `app/api/health/route.ts` | Alias logic. *Not in the original scope* — caught by grep. It fails soft (a bad key surfaces as a 502, not a throw), so it was not deploy-blocking, but it would have stayed quietly broken. |
| `check-teams.js` + the 7 `archive/scripts/*.js` one-offs from §10c | Same two-line fail-fast pattern in each; minimal style preserved, no restructuring. |
| `.env.local.example` | `SUPABASE_SECRET_KEY` documented as primary, `SUPABASE_SERVICE_ROLE_KEY` noted as an accepted legacy alias (commented out), `HEADSHOT_SECRET` unchanged. |

**Supersedes the §9e row for `SUPABASE_SERVICE_ROLE_KEY`** — nothing needs renaming in Vercel; the existing `SUPABASE_SECRET_KEY` is now read directly.

### 12d. Known remaining readers (deliberately left alone)

- `app/api/_lib/seasonGuard.js` — a **cross-project reference implementation, copied unmodified into each project**. Editing this copy would silently diverge it from the others. It only uses the key to log off-season skips and returns early when unset, so the failure mode is a missing log row, not a broken route. Fix it at the source and re-sync all copies.
- `scripts/staging/*.mjs`, `RUN_ON_MAC.sh`, and the ~30 other `archive/scripts/*.js` files — local, hand-run one-offs, untouched by §9/§10 and not on any deploy path. Several still carry pre-existing anon fallbacks. Worth a sweep, not urgent.

### 12e. Branch consolidation

`fix-mens-roster-scope` (bd3c0f9, §11) merged into `main` as a **fast-forward — no conflicts**, `main` having had nothing `bd3c0f9` lacked. `main` now carries §9 through §12 in one line, so a single `git push` ships everything.

### 12f. Verification

- `npx tsc --noEmit` → **clean (exit 0)**.
- `eslint` on all 12 changed code files, diffed against a HEAD baseline of the same files → **22 errors / 8 warnings before, 22 errors / 8 warnings after; no new findings**. All pre-existing (`no-require-imports` in the CommonJS one-offs, `no-explicit-any`, `ban-ts-comment`, unused vars); only line numbers shifted where comments were added. `scripts/lib/supabase-admin.ts` and `app/api/headshots/route.ts` remain eslint-clean.
- `node --check` on all 8 changed `.js` files → **8/8 OK**.
- No DB writes, no network calls, nothing pushed.

### 12g. Remaining manual steps for Chace

Nothing else is code-blocked; these are all outside this environment (no git credentials, no Vercel/Supabase write access here).

1. **Add `HEADSHOT_SECRET` in Vercel** (Preview + Production) — still the one genuinely missing variable. Generate with `openssl rand -hex 32`. Until it is set, `/api/headshots` returns 503 by design.
2. **Add the same `HEADSHOT_SECRET` to `.env.local`.** `SUPABASE_SECRET_KEY` should already be there; if `.env.local` only has `SUPABASE_SERVICE_ROLE_KEY`, that now works as-is — renaming is optional cleanup, not a fix.
3. **`git push`** — `main` is committed locally and unpushed.
4. **Redeploy** and confirm `/api/update` and `/api/health` return 200 rather than a missing-key throw.
5. **Load the secret into the extension** — §9f, unchanged: `chrome.storage.local.set({ headshotSecret: '…' })` in the service-worker console, using the same value set in Vercel.
6. Then §11f: re-scrape the men's rosters before the October season.

---

## 13. Phase 8 — graduation/departure reconciliation in the roster cron (2026-07-18)

Rosters only ever grew. The cron upserted whoever it scraped and left everyone else alone — a placeholder comment in `app/api/update/route.ts` read *"Mark athletes not in this batch as potentially archived (we skip this for safety — manual review is better)."* So graduated seniors stayed in search and on team pages indefinitely. This closes that loop.

### 13a. Where the logic went, and why there

**`app/api/update/route.ts`** — the Vercel-cron roster refresh, replacing that placeholder comment. It is the only committed, scheduled, authoritative refresh: it already fetches each team's roster, already upserts per team, and already has the per-team athlete list in hand.

The three other candidates were considered and rejected:

| Candidate | Why not |
|---|---|
| `scripts/rescrape-teams.ts` | `teamsToScrape` is an empty array — currently a no-op. Hand-run Playwright one-off, and it raw-`INSERT`s rather than upserting. |
| `scripts/staging/swimcloud-roster-apply.mjs` | Applies a hand-produced JSON from `SWIMCLOUD-ROSTER-REFRESH.md`. A staging one-off, not a recurring refresh. |
| `scripts/staging/rescrape-rosters.mjs` | **Untracked** (never committed). Its own header calls it a port of `route.ts` that "bypasses the seasonGuard/10-team cap" — a scratch tool. See the open item in §13f. |

### 13b. What it does

After a team's roster is successfully scraped and upserted, every athlete row for that team that is **not** on the freshly scraped roster is set `is_archived = true`.

A snapshot of the team's rows is read **before** the upsert loop, deliberately. The upsert writes `is_archived: false` on every scraped athlete, so an after-the-fact read can no longer distinguish a returning athlete from a steady-state one — and the partial-scrape guard needs the *pre-refresh* active count as its denominator.

Identity matching prefers `swimcloud_id` and falls back to a normalized name (lowercased, accent-stripped, punctuation-stripped, **token-sorted**, so `Schmidt, Danny` ≡ `Danny Schmidt` and `José García` ≡ `Jose Garcia`). Note the SIDEARM player payload carries no Swimcloud id, so in practice today every match runs through the name path; the id path is plumbed for any future Swimcloud-sourced caller.

That name key is intentionally **looser** than the upsert's exact `onConflict: "team_id,name"`. The bias is one-directional and deliberate: being too loose leaves a stale row active (harmless, visible, fixable), while being too strict archives someone who never left. Digits are stripped along with other non-letters, which is why a mismatch can only ever *under*-archive.

### 13c. The guards — a flaky scrape must never mass-archive a roster

All four bail out **before any write** and log a warning naming the team; the refresh itself still succeeds.

| Guard | Trips when | Rationale |
|---|---|---|
| `empty_scrape` | scrape returned 0 athletes | A site outage, a changed API shape, or a missed sport id all surface as zero rows. Archiving on that wipes a whole roster out of the tracker. |
| `partial_scrape` | scraped < **50%** of the team's pre-refresh active count | A half-loaded roster (pagination cut short, men's/women's split mis-parsed) returns a plausible but truncated list. 16-of-34 is a bad scrape, not 18 departures. |
| `cap_exceeded` | departures > **30** for one team in one run | Past the ratio guard, a large departure list usually means a systematic mismatch (a site that reformatted every name), not real attrition. Skips the team **entirely** rather than archiving a partial subset. |
| `snapshot_unavailable` | the pre-refresh snapshot read failed | No valid basis for comparison. |

A failed archive UPDATE is reported the same way (`update_failed`) rather than being swallowed.

Guard trips are surfaced three ways, because a silently-skipped archive is exactly the thing that would otherwise go unnoticed: a `console.warn` per team, an `archiveGuardTrips` array in the JSON response and in the ntfy/Slack alert payload, and an appended note on the `swim_sync_log` row.

### 13d. Archived, never deleted — and it is reversible

Departures are archived, **never** deleted, and no results table is touched. `swim_individual_results` joins meet history on `athletes.swimcloud_id`; deleting a departed athlete orphans every result they ever swam (Danny Schmidt alone has 29 result rows). Deletion was explicitly out of scope.

`is_archived = true` is sufficient to drop an athlete from the tracker — `app/search/page.tsx:34` and `app/team/[id]/page.tsx:80` both already filter `.eq("is_archived", false)`, so this needed **zero UI work**. The row and its full results history stay intact and queryable.

Reversal is automatic in both directions: the upsert at `route.ts` writes `is_archived: false`, so an athlete who reappears on any scraped roster is un-archived with no manual step. The only write this feature performs is `UPDATE athletes SET is_archived = true, updated_at = now() WHERE id IN (…)`.

### 13e. Transfers and graduations are indistinguishable — by design

From a single team's perspective there is no difference: both are "no longer on this roster", and the roster gives no signal about which. **Both archive.** The difference only resolves later — when the transfer's *new* team is scraped, the upsert un-archives them under the new `team_id`. A graduation simply never gets un-archived.

Two consequences worth knowing:

- A transfer is briefly archived — invisible in the tracker — between their old team's refresh and their new team's. With `STALE_DAYS = 7` and `MAX_TEAMS_PER_RUN = 10`, that window can be up to a few cron cycles. It is self-healing, not a state anyone needs to repair.
- If the new team isn't in `ROSTER_URLS` at all, the transfer stays archived permanently. That is arguably correct — they are no longer on a tracked roster — but it is a judgement call, not a law.

### 13f. Verification and open items

- `npx tsc --noEmit` → **clean (exit 0)**.
- `eslint app/api/update/route.ts`, diffed against a HEAD baseline of the same file → **3 errors / 1 warning before, 3 errors / 1 warning after; no new findings.** All pre-existing (two `ban-ts-comment` on the `@ts-ignore` imports, and the misplaced disable directive + `no-explicit-any` on `writeSyncLog`).
- **36-assertion throwaway harness** over the real extracted `reconcileDepartures` + `normalizeName` source, against a stubbed Supabase client that throws on `delete`/`insert`/`upsert`: all four guards verified to write nothing, the 50% boundary verified inclusive (17-of-34 proceeds, 16-of-34 does not), accent/comma/apostrophe/whitespace variants verified as matches rather than departures, `swimcloud_id` verified to win over a differing name, already-archived athletes verified not to be re-written, and returning athletes verified to count as un-archived rather than departed. The harness lived in `/tmp` and was not committed — there is no test runner in this repo to host it.
- No DB writes, no network calls, nothing pushed.

Open items:

1. **`scripts/staging/rescrape-rosters.mjs` does not reconcile.** It is untracked, so it was left alone rather than swept into this commit. If Chace runs it for the pre-season full refresh (§11f) instead of letting the cron work through teams 10-at-a-time, departures will not be archived on that pass — the next cron cycle over each team will catch them. Porting the same logic (or committing the script) is the clean fix.
2. **The `unarchived` count mirrors the upsert's exact-name key**, not the looser normalized key. An archived athlete who returns under a *reformatted* name is upserted as a new row and the old archived row stays archived — reported honestly as matched-but-not-un-archived. Rare, and it produces a stale archived row rather than any data loss.
3. **Nothing bulk-archives the existing backlog.** Seniors who graduated before this shipped are only archived when their team's next refresh runs.
