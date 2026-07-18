import { createClient } from "@/lib/supabase/client";
import type {
  AthleteBestTime,
  RecentMeet,
  SwimMeet,
  MeetDetailResult,
  MeetResultRow,
  MeetByTeamResult,
  MeetTeamGroup,
} from "@/lib/supabase/types";

// teamNameToSlug + TEAM_SLUG_OVERRIDES now live in lib/teamSlug.ts so the
// server-only headshot route can share them without importing this module
// (which builds an anon browser client at load). Re-exported for callers.
import { teamNameToSlug } from "@/lib/teamSlug";
export { teamNameToSlug } from "@/lib/teamSlug";

export function formatSwimTime(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds >= 60) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(2).padStart(5, "0");
    return `${mins}:${secs}`;
  }
  return totalSeconds.toFixed(2);
}

const EVENT_NAME_MAP: Record<string, string> = {
  "50-free": "50 Free",
  "100-free": "100 Free",
  "200-free": "200 Free",
  "500-free": "500 Free",
  "1000-free": "1000 Free",
  "1650-free": "1650 Free",
  "100-back": "100 Back",
  "200-back": "200 Back",
  "100-breast": "100 Breast",
  "200-breast": "200 Breast",
  "100-fly": "100 Fly",
  "200-fly": "200 Fly",
  "200-im": "200 IM",
  "400-im": "400 IM",
  "200-free-relay": "200 Free Relay",
  "400-free-relay": "400 Free Relay",
  "800-free-relay": "800 Free Relay",
  "200-medley-relay": "200 Medley Relay",
  "400-medley-relay": "400 Medley Relay",
  "1m-diving": "1m Diving",
  "3m-diving": "3m Diving",
  "platform-diving": "Platform Diving",
};

export function formatEventName(eventId: string): string {
  return (
    EVENT_NAME_MAP[eventId] ??
    eventId
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

// Resolve an athlete's swimcloud_id — the join key into the swim results
// ecosystem (swim_individual_results.athlete_id). Resolved from the canonical
// `athletes` table, which carries swimcloud_id for every tracked roster athlete.
async function findSwimcloudId(
  athleteName: string,
  teamName: string,
): Promise<string | null> {
  const supabase = createClient();

  // The athlete detail page passes athletes.name and teams.name, so match those
  // directly via the athletes→teams relation.
  const { data: canonical } = await supabase
    .from("athletes")
    .select("swimcloud_id, teams!inner(name)")
    .eq("name", athleteName)
    .eq("teams.name", teamName)
    .not("swimcloud_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (canonical?.swimcloud_id) return canonical.swimcloud_id as string;
  return null;
}

export async function getAthleteBestTimes(
  athleteName: string,
  teamName: string,
): Promise<AthleteBestTime[]> {
  const supabase = createClient();
  const swimcloudId = await findSwimcloudId(athleteName, teamName);
  if (!swimcloudId) return [];

  const { data: results } = await supabase
    .from("swim_individual_results")
    .select("event_id, final_time_ms, final_place, meet_id")
    .eq("athlete_id", swimcloudId)
    .order("final_time_ms", { ascending: true });

  if (!results || results.length === 0) return [];

  // Group by event_id, keep best (lowest) time
  const bestByEvent = new Map<
    string,
    { timeMs: number; place: number | null; meetId: number }
  >();

  for (const row of results) {
    const existing = bestByEvent.get(row.event_id);
    if (!existing || row.final_time_ms < existing.timeMs) {
      bestByEvent.set(row.event_id, {
        timeMs: row.final_time_ms,
        place: row.final_place,
        meetId: Number(row.meet_id),
      });
    }
  }

  // Fetch meet names for all meet IDs needed
  const meetIds = Array.from(
    new Set(Array.from(bestByEvent.values()).map((v) => v.meetId)),
  );
  const { data: meets } = await supabase
    .from("swim_meets")
    .select("id, name, date_start")
    .in("id", meetIds);

  const meetMap = new Map<
    number,
    { name: string; date_start: string | null }
  >();
  for (const m of meets ?? []) {
    meetMap.set(m.id, { name: m.name, date_start: m.date_start });
  }

  const output: AthleteBestTime[] = [];
  for (const [eventId, best] of bestByEvent.entries()) {
    const meet = meetMap.get(best.meetId);
    output.push({
      eventId,
      eventName: formatEventName(eventId),
      timeMs: best.timeMs,
      timeFormatted: formatSwimTime(best.timeMs),
      place: best.place,
      meetName: meet?.name ?? "Unknown Meet",
      meetDate: meet?.date_start ?? null,
      meetId: best.meetId,
    });
  }

  return output.sort((a, b) => a.eventId.localeCompare(b.eventId));
}

export async function getAthleteRecentMeets(
  athleteName: string,
  teamName: string,
  limit = 5,
): Promise<RecentMeet[]> {
  const supabase = createClient();
  const swimcloudId = await findSwimcloudId(athleteName, teamName);
  if (!swimcloudId) return [];

  const { data: results } = await supabase
    .from("swim_individual_results")
    .select("meet_id, event_id, final_time_ms")
    .eq("athlete_id", swimcloudId);

  if (!results || results.length === 0) return [];

  // Group events and times by meet_id
  const byMeet = new Map<string, { events: string[]; times: string[] }>();
  for (const row of results) {
    if (!byMeet.has(row.meet_id)) {
      byMeet.set(row.meet_id, { events: [], times: [] });
    }
    const entry = byMeet.get(row.meet_id)!;
    entry.events.push(formatEventName(row.event_id));
    entry.times.push(formatSwimTime(row.final_time_ms));
  }

  const meetIds = Array.from(byMeet.keys()).map(Number);
  const { data: meets } = await supabase
    .from("swim_meets")
    .select("id, name, date_start, location")
    .in("id", meetIds)
    .order("date_start", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (!meets) return [];

  return meets.map((m) => {
    const entry = byMeet.get(String(m.id)) ?? { events: [], times: [] };
    return {
      id: m.id,
      name: m.name,
      date_start: m.date_start,
      location: m.location,
      events: entry.events,
      times: entry.times,
    };
  });
}

export async function getAllMeets(
  options: { limit?: number } = {},
): Promise<SwimMeet[]> {
  const supabase = createClient();
  const limit = options.limit ?? 100;

  const { data, error } = await supabase
    .from("swim_meets")
    .select(
      "id, name, url, season, date_start, date_end, location, course_type",
    )
    .eq("season", "2024-25")
    .order("date_start", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];
  return data as SwimMeet[];
}

function isDiveEvent(eventId: string): boolean {
  return /-diving$/.test(eventId);
}

// Internal: load + decorate every row of a meet exactly once. Both byEvent and
// byTeam views share this loader.
async function loadMeetRows(meetId: number): Promise<{
  meet: SwimMeet;
  rows: (MeetResultRow & { eventId: string; eventName: string })[];
} | null> {
  const supabase = createClient();

  const { data: meet, error: meetError } = await supabase
    .from("swim_meets")
    .select(
      "id, name, url, season, date_start, date_end, location, course_type",
    )
    .eq("id", meetId)
    .single();

  if (meetError || !meet) return null;

  const { data: results } = await supabase
    .from("swim_individual_results")
    .select("event_id, athlete_id, final_time_ms, final_place, final_score")
    .eq("meet_id", String(meetId))
    .order("event_id")
    .order("final_place", { ascending: true, nullsFirst: false });

  if (!results || results.length === 0) {
    return { meet: meet as SwimMeet, rows: [] };
  }

  const athleteIds = Array.from(new Set(results.map((r) => r.athlete_id)));

  // Resolve swimcloud_id -> { name, team-slug } for display via the canonical
  // `athletes` table (mapped to the swim-style team slug). Result ids with no
  // matching athletes row render as "Athlete #id" (handled by the row builder).
  const athleteMap = new Map<string, { name: string; teamId: string }>();

  const { data: canonAthletes } = await supabase
    .from("athletes")
    .select("swimcloud_id, name, team_id")
    .in("swimcloud_id", athleteIds)
    .not("swimcloud_id", "is", null);

  // athletes.team_id is a teams uuid; map it to the swim-style slug the meet
  // views group and display on (e.g. "ohio-state").
  const teamUuids = Array.from(
    new Set((canonAthletes ?? []).map((a) => a.team_id).filter(Boolean)),
  );
  const teamSlugByUuid = new Map<string, string>();
  if (teamUuids.length > 0) {
    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", teamUuids);
    for (const t of teamRows ?? []) {
      teamSlugByUuid.set(t.id, teamNameToSlug(t.name));
    }
  }

  for (const a of canonAthletes ?? []) {
    if (a.swimcloud_id) {
      athleteMap.set(a.swimcloud_id, {
        name: a.name,
        teamId: a.team_id ? (teamSlugByUuid.get(a.team_id) ?? "") : "",
      });
    }
  }

  const rows: (MeetResultRow & { eventId: string; eventName: string })[] =
    results.map((r) => {
      const athlete = athleteMap.get(r.athlete_id);
      const isDive = isDiveEvent(r.event_id);
      return {
        eventId: r.event_id,
        eventName: formatEventName(r.event_id),
        eventType: isDive ? "dive" : "swim",
        place: r.final_place,
        athleteName: athlete?.name ?? `Athlete #${r.athlete_id}`,
        athleteId: r.athlete_id,
        teamId: athlete?.teamId ?? "",
        timeMs: r.final_time_ms ?? 0,
        timeFormatted: r.final_time_ms ? formatSwimTime(r.final_time_ms) : "",
        finalScore:
          // final_score column added by Pass 1 staging cutover; column may be
          // null on legacy rows or absent if the cutover hasn't run yet.
          typeof (r as { final_score?: number | null }).final_score === "number"
            ? ((r as { final_score?: number | null }).final_score as number)
            : null,
      };
    });

  return { meet: meet as SwimMeet, rows };
}

export async function getMeetResults(
  meetId: number,
): Promise<MeetDetailResult | null> {
  const loaded = await loadMeetRows(meetId);
  if (!loaded) return null;
  const { meet, rows } = loaded;

  // Group by event_id
  const eventGroupMap = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!eventGroupMap.has(row.eventId)) {
      eventGroupMap.set(row.eventId, []);
    }
    eventGroupMap.get(row.eventId)!.push(row);
  }

  const eventGroups = Array.from(eventGroupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([eventId, eventResults]) => ({
      eventId,
      eventName: formatEventName(eventId),
      eventType: isDiveEvent(eventId) ? ("dive" as const) : ("swim" as const),
      results: eventResults,
    }));

  return { meet, eventGroups };
}

export async function getMeetResultsByTeam(
  meetId: number,
): Promise<MeetByTeamResult | null> {
  const loaded = await loadMeetRows(meetId);
  if (!loaded) return null;
  const { meet, rows } = loaded;

  // Group by team_id
  const teamMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.teamId || "__unaffiliated";
    if (!teamMap.has(key)) teamMap.set(key, []);
    teamMap.get(key)!.push(row);
  }

  const teamGroups: MeetTeamGroup[] = Array.from(teamMap.entries())
    .map(([teamId, teamRows]) => ({
      teamId,
      teamName:
        teamId === "__unaffiliated"
          ? "Unaffiliated"
          : teamId
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" "),
      athleteCount: new Set(teamRows.map((r) => r.athleteId)).size,
      rows: teamRows.sort((a, b) =>
        a.eventId === b.eventId
          ? (a.place ?? 999) - (b.place ?? 999)
          : a.eventId.localeCompare(b.eventId),
      ),
    }))
    .sort((a, b) => b.athleteCount - a.athleteCount);

  return { meet, teamGroups };
}
