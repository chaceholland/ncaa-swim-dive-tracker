-- =====================================================================
-- Swim NCAA D1 Men's Championships 2026 — cutover from staging → live.
-- Supersedes 002_cutover_ncaa_champs_DRAFT.sql, which predated the scraper
-- rework and would have (a) dropped 54% of individuals to "unmatched",
-- (b) dumped relay leg-splits into swim_individual_results. Do not run 002.
--
-- This file targets project dtnozcqkuzhjmjvsfjqk only.
--
-- ⚠️  DO NOT RUN UNTIL:
--    1. import-ncaa-champs-2026.mjs --apply has populated the NEW staging
--       tables (swim_staging_ncaa_champs_2026_results + _relays).
--    2. Chace has reviewed staging counts and approves.
--    3. A snapshot / PITR point exists for swim_meets, swim_individual_results,
--       swim_relay_results, swim_athletes, swim_teams.
--
-- Idempotent: re-running replaces this meet's live rows (delete-then-insert),
-- backfills only missing athletes, and only fills empty swim_teams.swimcloud_id.
-- Wrapped in a single transaction — any failure rolls the whole thing back.
-- =====================================================================

begin;

-- 0. Sanity: staging must be populated.
do $$
declare n int;
begin
  select count(*) into n from swim_staging_ncaa_champs_2026_results;
  if n = 0 then raise exception 'staging results empty; aborting cutover'; end if;
end $$;

-- 1. Meet → swim_meets (reuse Swimcloud id 351190 so re-runs are idempotent).
insert into swim_meets (id, name, url, season, date_start, date_end, location, course_type)
select m.swimcloud_id, m.name, m.url, '2025-26',
       coalesce(m.date_start, '2026-03-25'::date),
       coalesce(m.date_end,   '2026-03-28'::date),
       m.location, coalesce(m.course_type, 'SCY')
from swim_staging_ncaa_champs_2026_meet m
on conflict (id) do update set
  name = excluded.name, url = excluded.url, season = excluded.season,
  date_start = excluded.date_start, date_end = excluded.date_end,
  location = excluded.location, course_type = excluded.course_type;

-- Distinct staged teams with a suffix-stripped name ("California (A)" -> "california").
create temp table _staged_teams on commit drop as
select distinct team_swimcloud_id,
       lower(regexp_replace(team_name, '\s*\([a-z]\)\s*$', '', 'i')) as norm_name
from (
  select team_swimcloud_id, team_name from swim_staging_ncaa_champs_2026_results
  union all
  select team_swimcloud_id, team_name from swim_staging_ncaa_champs_2026_relays
) z
where team_swimcloud_id is not null;

-- 2. Map team_swimcloud_id -> swim_teams.id by NAME (+ a few aliases).
--    swim_teams.swimcloud_id is deliberately NOT used: it disagrees with this
--    meet's /team/ ids (the Tennessee row carried Auburn's id 127, Louisville
--    carried SMU's 75, etc.), so trusting it cross-maps different schools onto
--    one team. School names are reliable; aliases cover the handful of rows
--    stored under a short name. Schools absent from swim_teams (small programs:
--    Air Force, Davidson, Drexel, Hawaii, …) resolve to NULL team_id — accepted,
--    the column is nullable. This is also the "Cal/Utah" step: id=cal is named
--    "California" (matches the scrape) and id=utah is "Utah Utes" (aliased).
create temp table _team_map on commit drop as
select st.team_swimcloud_id, t.id as team_id
from _staged_teams st
left join swim_teams t on lower(t.name) = case st.norm_name
    when 'southern methodist' then 'smu'
    when 'louisiana state'    then 'lsu'
    when 'utah'               then 'utah utes'
    else st.norm_name end;

-- 4. Backfill athletes missing from swim_athletes (id auto = gen_random_uuid()).
--    swim_individual_results.athlete_id holds the swimcloud_id (text), confirmed
--    against 111k existing rows — so we key athletes on swimcloud_id.
insert into swim_athletes (name, swimcloud_id, team_id)
select distinct on (s.swimcloud_id)
       s.athlete_name, s.swimcloud_id::text, tm.team_id
from swim_staging_ncaa_champs_2026_results s
left join _team_map tm on tm.team_swimcloud_id = s.team_swimcloud_id
where s.swimcloud_id is not null
  and not exists (select 1 from swim_athletes a where a.swimcloud_id = s.swimcloud_id::text)
order by s.swimcloud_id;

-- Relay leg swimmers may not appear in any individual event — backfill them too.
insert into swim_athletes (name, swimcloud_id, team_id)
select distinct on (legs.sc) legs.nm, legs.sc::text, tm.team_id
from (
  select leg1_swimcloud_id sc, leg1_name nm, team_swimcloud_id from swim_staging_ncaa_champs_2026_relays where leg1_swimcloud_id is not null
  union all select leg2_swimcloud_id, leg2_name, team_swimcloud_id from swim_staging_ncaa_champs_2026_relays where leg2_swimcloud_id is not null
  union all select leg3_swimcloud_id, leg3_name, team_swimcloud_id from swim_staging_ncaa_champs_2026_relays where leg3_swimcloud_id is not null
  union all select leg4_swimcloud_id, leg4_name, team_swimcloud_id from swim_staging_ncaa_champs_2026_relays where leg4_swimcloud_id is not null
) legs
left join _team_map tm on tm.team_swimcloud_id = legs.team_swimcloud_id
where not exists (select 1 from swim_athletes a where a.swimcloud_id = legs.sc::text)
order by legs.sc;

-- 5. Individual results (prelim + final in one row). Delete-then-insert = idempotent.
delete from swim_individual_results where meet_id = '351190';
insert into swim_individual_results
  (meet_id, event_id, athlete_id, team_id, round, course,
   prelim_time_ms, prelim_place, prelim_score,
   final_time_ms, final_place, final_score)
select '351190', s.event_id, s.swimcloud_id::text, tm.team_id, 'finals', 'SCY',
       s.prelim_time_ms, s.prelim_place, s.prelim_score,
       s.final_time_ms, s.final_place, s.final_score
from swim_staging_ncaa_champs_2026_results s
left join _team_map tm on tm.team_swimcloud_id = s.team_swimcloud_id
where s.swimcloud_id is not null;

-- 6. Relay results. Delete-then-insert; on conflict do nothing guards the rare
--    case of two staged squads mapping to the same swim_teams.id.
delete from swim_relay_results where meet_id = '351190';
insert into swim_relay_results
  (meet_id, event_id, team_id, round, course, final_time_ms, final_place, points_scored,
   leg1_athlete_id, leg1_split, leg2_athlete_id, leg2_split,
   leg3_athlete_id, leg3_split, leg4_athlete_id, leg4_split)
select '351190', s.event_id, tm.team_id, 'finals', 'SCY',
       s.final_time_ms, s.final_place, s.points,
       s.leg1_swimcloud_id::text, s.leg1_split_ms,
       s.leg2_swimcloud_id::text, s.leg2_split_ms,
       s.leg3_swimcloud_id::text, s.leg3_split_ms,
       s.leg4_swimcloud_id::text, s.leg4_split_ms
from swim_staging_ncaa_champs_2026_relays s
left join _team_map tm on tm.team_swimcloud_id = s.team_swimcloud_id
on conflict (meet_id, event_id, team_id) do nothing;

-- 7. Verify before committing.
do $$
declare ind int; rel int; noteam_ind int; noteam_rel int;
begin
  select count(*) into ind from swim_individual_results where meet_id = '351190';
  select count(*) into rel from swim_relay_results      where meet_id = '351190';
  select count(*) into noteam_ind from swim_individual_results where meet_id = '351190' and team_id is null;
  select count(*) into noteam_rel from swim_relay_results      where meet_id = '351190' and team_id is null;
  raise notice 'individual=% (% w/o team), relay=% (% w/o team)', ind, noteam_ind, rel, noteam_rel;
  if ind < 600 then raise exception 'individual < 600, aborting (sanity)'; end if;
end $$;

commit;

-- =====================================================================
-- ROLLBACK (run separately if cutover went bad). Note: backfilled athletes
-- are intentionally left in place (harmless, reused by future imports).
-- =====================================================================
-- begin;
--   delete from swim_individual_results where meet_id = '351190';
--   delete from swim_relay_results      where meet_id = '351190';
--   delete from swim_meets where id = 351190;
-- commit;
