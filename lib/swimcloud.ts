import { createClient } from "@/lib/supabase/client";
import type {
  AthleteBestTime,
  RecentMeet,
  SwimMeet,
  MeetDetailResult,
} from "@/lib/supabase/types";

export function teamNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

async function findSwimcloudId(
  athleteName: string,
  teamName: string,
): Promise<string | null> {
  const supabase = createClient();
  const slug = teamNameToSlug(teamName);
  const nameParts = athleteName.trim().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];

  const { data } = await supabase
    .from("swim_athletes")
    .select("swimcloud_id")
    .eq("team_id", slug)
    .ilike("name", `%${lastName}%`)
    .not("swimcloud_id", "is", null)
    .limit(1)
    .single();

  return data?.swimcloud_id ?? null;
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

export async function getMeetResults(
  meetId: number,
): Promise<MeetDetailResult | null> {
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
    .select("event_id, athlete_id, final_time_ms, final_place")
    .eq("meet_id", String(meetId))
    .order("event_id")
    .order("final_time_ms", { ascending: true });

  if (!results || results.length === 0) {
    return {
      meet: meet as SwimMeet,
      eventGroups: [],
    };
  }

  // Collect unique athlete IDs
  const athleteIds = Array.from(new Set(results.map((r) => r.athlete_id)));

  // Fetch athlete names from swim_athletes
  const { data: athletes } = await supabase
    .from("swim_athletes")
    .select("swimcloud_id, name, team_id")
    .in("swimcloud_id", athleteIds);

  const athleteMap = new Map<string, { name: string; teamId: string }>();
  for (const a of athletes ?? []) {
    if (a.swimcloud_id) {
      athleteMap.set(a.swimcloud_id, { name: a.name, teamId: a.team_id });
    }
  }

  // Group by event_id
  const eventGroupMap = new Map<
    string,
    {
      place: number | null;
      athleteName: string;
      teamId: string;
      timeMs: number;
      timeFormatted: string;
    }[]
  >();

  for (const row of results) {
    if (!eventGroupMap.has(row.event_id)) {
      eventGroupMap.set(row.event_id, []);
    }
    const athlete = athleteMap.get(row.athlete_id);
    eventGroupMap.get(row.event_id)!.push({
      place: row.final_place,
      athleteName: athlete?.name ?? `Athlete #${row.athlete_id}`,
      teamId: athlete?.teamId ?? "",
      timeMs: row.final_time_ms,
      timeFormatted: formatSwimTime(row.final_time_ms),
    });
  }

  const eventGroups = Array.from(eventGroupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([eventId, eventResults]) => ({
      eventId,
      eventName: formatEventName(eventId),
      results: eventResults,
    }));

  return {
    meet: meet as SwimMeet,
    eventGroups,
  };
}
