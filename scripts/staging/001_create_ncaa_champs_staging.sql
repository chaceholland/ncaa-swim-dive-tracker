-- Swim Pass 1 / Chunk A — staging tables for NCAA 2026 D1 Men's Championships import.
-- Additive only: nothing here references the live tables. Safe to apply ahead of cutover.
-- Apply with: curl -X POST https://api.supabase.com/v1/projects/dtnozcqkuzhjmjvsfjqk/database/query ... (see reference_supabase_pat.md)
--
-- Reworked 2026-06-16 after a DOM audit of Swimcloud event pages:
--   * Individual events expose separate Finals + Preliminaries tables, so the
--     results table now carries BOTH rounds per swimmer (prelim_* and final_*).
--   * Relays are squads (team + 4 legs + total), not per-swimmer rows, so they
--     get their own table instead of polluting individual results.

create table if not exists swim_staging_ncaa_champs_2026_meet (
  id              bigserial primary key,
  swimcloud_id    bigint unique,   -- upsert onConflict target in import-ncaa-champs-2026.mjs
  name            text not null,
  date_start      date,
  date_end        date,
  location        text,
  course_type     text default 'SCY',
  url             text,
  season          text default '2025-26',
  scraped_at      timestamptz default now(),
  raw_payload     jsonb
);

-- Structure changed from the original flat schema; drop & recreate (staging only,
-- repopulated on every --apply run).
drop table if exists swim_staging_ncaa_champs_2026_results cascade;
create table swim_staging_ncaa_champs_2026_results (
  id                bigserial primary key,
  meet_staging_id   bigint references swim_staging_ncaa_champs_2026_meet(id) on delete cascade,
  event_id          text not null,                                  -- DB slug, e.g. 100-back
  event_type        text not null check (event_type in ('swim','dive')),
  athlete_name      text,
  team_name         text,
  swimcloud_id      bigint,                                         -- athlete
  team_swimcloud_id bigint,
  prelim_time_ms    bigint,
  prelim_place      int,
  prelim_score      numeric(8,3),
  final_time_ms     bigint,
  final_place       int,
  final_score       numeric(8,3),
  scraped_at        timestamptz default now(),
  raw_payload       jsonb,
  unique (meet_staging_id, event_id, swimcloud_id)
);
create index if not exists swim_staging_ncaa_champs_2026_results_event_idx
  on swim_staging_ncaa_champs_2026_results(event_id);

drop table if exists swim_staging_ncaa_champs_2026_relays cascade;
create table swim_staging_ncaa_champs_2026_relays (
  id                bigserial primary key,
  meet_staging_id   bigint references swim_staging_ncaa_champs_2026_meet(id) on delete cascade,
  event_id          text not null,                                  -- e.g. 200-free-relay
  team_name         text,
  team_swimcloud_id bigint,
  final_time_ms     bigint,                                         -- squad total
  final_place       int,
  points            numeric(8,3),
  leg1_swimcloud_id bigint, leg1_name text, leg1_split_ms bigint,
  leg2_swimcloud_id bigint, leg2_name text, leg2_split_ms bigint,
  leg3_swimcloud_id bigint, leg3_name text, leg3_split_ms bigint,
  leg4_swimcloud_id bigint, leg4_name text, leg4_split_ms bigint,
  scraped_at        timestamptz default now(),
  raw_payload       jsonb,
  unique (meet_staging_id, event_id, team_swimcloud_id)
);
create index if not exists swim_staging_ncaa_champs_2026_relays_event_idx
  on swim_staging_ncaa_champs_2026_relays(event_id);

-- RLS: read = public (matches live convention), write = service_role only.
alter table swim_staging_ncaa_champs_2026_meet    enable row level security;
alter table swim_staging_ncaa_champs_2026_results enable row level security;
alter table swim_staging_ncaa_champs_2026_relays  enable row level security;

drop policy if exists ncaa_champs_meet_read on swim_staging_ncaa_champs_2026_meet;
create policy ncaa_champs_meet_read on swim_staging_ncaa_champs_2026_meet for select using (true);
drop policy if exists ncaa_champs_meet_write on swim_staging_ncaa_champs_2026_meet;
create policy ncaa_champs_meet_write on swim_staging_ncaa_champs_2026_meet
  for all to public using (current_setting('role') = 'service_role') with check (current_setting('role') = 'service_role');

drop policy if exists ncaa_champs_results_read on swim_staging_ncaa_champs_2026_results;
create policy ncaa_champs_results_read on swim_staging_ncaa_champs_2026_results for select using (true);
drop policy if exists ncaa_champs_results_write on swim_staging_ncaa_champs_2026_results;
create policy ncaa_champs_results_write on swim_staging_ncaa_champs_2026_results
  for all to public using (current_setting('role') = 'service_role') with check (current_setting('role') = 'service_role');

drop policy if exists ncaa_champs_relays_read on swim_staging_ncaa_champs_2026_relays;
create policy ncaa_champs_relays_read on swim_staging_ncaa_champs_2026_relays for select using (true);
drop policy if exists ncaa_champs_relays_write on swim_staging_ncaa_champs_2026_relays;
create policy ncaa_champs_relays_write on swim_staging_ncaa_champs_2026_relays
  for all to public using (current_setting('role') = 'service_role') with check (current_setting('role') = 'service_role');
