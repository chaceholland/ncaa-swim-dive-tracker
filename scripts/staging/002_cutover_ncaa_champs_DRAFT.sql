-- =====================================================================
-- Swim Pass 1 / Chunk F — DRAFT cutover from staging → live tables.
--
-- ⚠️  DO NOT RUN UNTIL:
--    1. import-ncaa-champs-2026.mjs --apply has populated the staging tables
--       on the Mac (sandbox is blocked by Cloudflare).
--    2. Chace has reviewed the staging row counts and explicitly approves.
--    3. A snapshot of swim_meets + swim_individual_results has been taken
--       (Supabase point-in-time recovery counts as one).
--
-- This file ONLY targets project dtnozcqkuzhjmjvsfjqk. Run via Management
-- API the same way the staging DDL went in.
-- =====================================================================

begin;

-- 0. Sanity: staging must be populated, else abort.
do $$
declare rcount int;
begin
  select count(*) into rcount from swim_staging_ncaa_champs_2026_results;
  if rcount = 0 then
    raise exception 'staging results table is empty; aborting cutover';
  end if;
end $$;

-- 1. Insert meet into live swim_meets.
--    swim_meets.id is integer — we reuse the Swimcloud meet_id (351190) so
--    re-runs are idempotent.
insert into swim_meets (id, name, url, season, date_start, date_end, location, course_type)
select
  m.swimcloud_id,                               -- 351190
  m.name,
  m.url,
  '2025-26',                                    -- explicit, since DB stale-defaults to '2024-25'
  coalesce(m.date_start, '2026-03-25'::date),   -- NCAAs date — refine after parsing meet page text
  coalesce(m.date_end,   '2026-03-28'::date),
  m.location,
  coalesce(m.course_type, 'SCY')
from swim_staging_ncaa_champs_2026_meet m
on conflict (id) do update set
  name = excluded.name,
  url  = excluded.url,
  season = excluded.season,
  date_start = excluded.date_start,
  date_end   = excluded.date_end,
  location   = excluded.location,
  course_type = excluded.course_type;

-- 2. For diving rows we need final_score column on swim_individual_results.
--    Add only if missing — additive, safe to re-run.
alter table swim_individual_results
  add column if not exists final_score numeric(8,3);

-- 3. Insert individual swim results.
--    Match athletes via swimcloud_id; skip rows where we can't find the
--    athlete (they go to a staging-leftover table for manual review).
create table if not exists swim_staging_ncaa_champs_2026_unmatched (
  staging_row_id bigint,
  reason text,
  raw jsonb,
  noted_at timestamptz default now()
);

with staged as (
  select r.*, m.swimcloud_id as meet_swimcloud_id
  from swim_staging_ncaa_champs_2026_results r
  join swim_staging_ncaa_champs_2026_meet m on m.id = r.meet_staging_id
),
matched_athlete as (
  select s.*, sa.id as athlete_uuid, sa.swimcloud_id as athlete_swimcloud_id
  from staged s
  left join swim_athletes sa on sa.swimcloud_id = s.swimcloud_id::text
)
-- Stash unmatched
,unmatched as (
  insert into swim_staging_ncaa_champs_2026_unmatched (staging_row_id, reason, raw)
  select id, 'no_swim_athletes_swimcloud_id_match', to_jsonb(matched_athlete.*)
  from matched_athlete
  where athlete_swimcloud_id is null
  returning 1
)
-- Insert matched
insert into swim_individual_results (meet_id, event_id, athlete_id, final_time_ms, final_place, final_score)
select
  meet_swimcloud_id::text,
  event_id,
  athlete_swimcloud_id,
  final_time_ms,
  final_place,
  final_score
from matched_athlete
where athlete_swimcloud_id is not null
on conflict (meet_id, event_id, athlete_id) do update set
  final_time_ms = excluded.final_time_ms,
  final_place   = excluded.final_place,
  final_score   = excluded.final_score;

-- 4. Verify
do $$
declare imported int; unmatched int;
begin
  select count(*) into imported from swim_individual_results where meet_id = (select swimcloud_id::text from swim_staging_ncaa_champs_2026_meet limit 1);
  select count(*) into unmatched from swim_staging_ncaa_champs_2026_unmatched;
  raise notice 'imported=%, unmatched=%', imported, unmatched;
  if imported < 100 then
    raise exception 'imported < 100, aborting (sanity check)';
  end if;
end $$;

commit;

-- =====================================================================
-- ROLLBACK (run separately if cutover went bad)
-- =====================================================================
-- begin;
-- delete from swim_individual_results where meet_id = '351190';
-- delete from swim_meets where id = 351190;
-- truncate swim_staging_ncaa_champs_2026_unmatched;
-- commit;
