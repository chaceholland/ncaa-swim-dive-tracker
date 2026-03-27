import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ── Supabase (server-side, service role) ───────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase credentials");
  }
  return createClient(url, key);
}

// ── Types ──────────────────────────────────────────────────────────
interface TeamRow {
  id: string;
  name: string;
  updated_at: string | null;
}

interface RosterUrlEntry {
  teamName: string;
  url: string;
}

interface SidearmPlayer {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  academic_year?: string;
  academic_year_display?: string;
  position?: string;
  hometown?: string;
  headshot_url?: string;
  roster_image?: string;
  slug?: string;
}

interface UpdateResult {
  team: string;
  teamId: string;
  status: "updated" | "skipped" | "failed" | "sidearm_unavailable";
  athleteCount: number;
  error?: string;
}

// ── Roster URLs (same set as scrape-athletes-v2.ts) ────────────────
// Each URL doubles as the SIDEARM API base when we strip /roster
const ROSTER_URLS: RosterUrlEntry[] = [
  // SEC
  {
    teamName: "Florida",
    url: "https://floridagators.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Texas",
    url: "https://texassports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Alabama",
    url: "https://rolltide.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Auburn",
    url: "https://auburntigers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Georgia",
    url: "https://georgiadogs.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Tennessee",
    url: "https://utsports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Missouri",
    url: "https://mutigers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Kentucky",
    url: "https://ukathletics.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "LSU",
    url: "https://lsusports.net/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "South Carolina",
    url: "https://gamecocksonline.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Texas A&M",
    url: "https://12thman.com/sports/mens-swimming-and-diving/roster",
  },
  // ACC
  {
    teamName: "Virginia",
    url: "https://virginiasports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "NC State",
    url: "https://gopack.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Notre Dame",
    url: "https://und.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Pittsburgh",
    url: "https://pittsburghpanthers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Louisville",
    url: "https://gocards.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Virginia Tech",
    url: "https://hokiesports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Duke",
    url: "https://goduke.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "North Carolina",
    url: "https://goheels.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Boston College",
    url: "https://bceagles.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Georgia Tech",
    url: "https://ramblinwreck.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Stanford",
    url: "https://gostanford.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Cal",
    url: "https://calbears.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "SMU",
    url: "https://smumustangs.com/sports/mens-swimming-and-diving/roster",
  },
  // Big Ten
  {
    teamName: "Indiana",
    url: "https://iuhoosiers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Ohio State",
    url: "https://ohiostatebuckeyes.com/sports/m-swim/roster/",
  },
  {
    teamName: "Michigan",
    url: "https://mgoblue.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Penn State",
    url: "https://gopsusports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Northwestern",
    url: "https://nusports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Minnesota",
    url: "https://gophersports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Purdue",
    url: "https://purduesports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Wisconsin",
    url: "https://uwbadgers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "USC",
    url: "https://usctrojans.com/sports/mens-swimming-and-diving/roster",
  },
  // Big 12
  {
    teamName: "Arizona State",
    url: "https://thesundevils.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "West Virginia",
    url: "https://wvusports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "TCU",
    url: "https://gofrogs.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Utah",
    url: "https://utahutes.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Arizona",
    url: "https://arizonawildcats.com/sports/mens-swimming-and-diving/roster",
  },
  // Ivy League
  {
    teamName: "Harvard",
    url: "https://gocrimson.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Yale",
    url: "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Princeton",
    url: "https://goprincetontigers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Columbia",
    url: "https://gocolumbialions.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Penn",
    url: "https://pennathletics.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Cornell",
    url: "https://cornellbigred.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Brown",
    url: "https://brownbears.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Dartmouth",
    url: "https://dartmouthsports.com/sports/mens-swimming-and-diving/roster",
  },
  // Patriot League
  {
    teamName: "Navy",
    url: "https://navysports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Army",
    url: "https://goarmywestpoint.com/sports/mens-swimming-and-diving/roster",
  },
  // Other
  {
    teamName: "George Washington",
    url: "https://gwsports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Towson",
    url: "https://towsontigers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Southern Illinois",
    url: "https://siusalukis.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "UNLV",
    url: "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
  },
  {
    teamName: "Florida State",
    url: "https://seminoles.com/sports/swimming-diving-m/roster/",
  },
];

// ── Helpers ────────────────────────────────────────────────────────

/** Return true when updated_at is more than `days` old (or null). */
function isStale(updatedAt: string | null, days: number): boolean {
  if (!updatedAt) return true;
  const then = new Date(updatedAt).getTime();
  const now = Date.now();
  return now - then > days * 24 * 60 * 60 * 1000;
}

/** Map raw academic year text to the enum the DB expects. */
function mapClassYear(
  raw: string,
): "freshman" | "sophomore" | "junior" | "senior" | null {
  const lc = (raw ?? "").toLowerCase();
  if (lc.includes("fr")) return "freshman";
  if (lc.includes("so")) return "sophomore";
  if (lc.includes("jr") || lc.includes("junior")) return "junior";
  if (lc.includes("sr") || lc.includes("senior")) return "senior";
  return null;
}

/**
 * Attempt to fetch roster via the SIDEARM v3 JSON API.
 *
 * Most NCAA athletics sites run on SIDEARM Sports and expose:
 *   GET /api/v2/sports?category=0          -> find the sport id
 *   GET /api/v2/players?sport_id=<id>      -> full roster JSON
 *
 * This avoids needing a headless browser.  Returns null if the site
 * doesn't have the API (non-SIDEARM or older version).
 */
async function fetchSidearmRoster(
  rosterUrl: string,
): Promise<SidearmPlayer[] | null> {
  // Derive the origin from the roster URL
  const origin = new URL(rosterUrl).origin;

  try {
    // Step 1: find the sport id for swimming
    const sportsRes = await fetch(`${origin}/api/v2/sports?category=0`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!sportsRes.ok) return null;

    const sportsBody = await sportsRes.json();
    const sports: Array<{ id: number; title: string; slug: string }> =
      Array.isArray(sportsBody) ? sportsBody : (sportsBody?.data ?? []);

    const swimSport = sports.find(
      (s) =>
        s.slug?.includes("swim") ||
        s.title?.toLowerCase().includes("swim") ||
        s.slug?.includes("m-swim"),
    );
    if (!swimSport) return null;

    // Step 2: fetch players for that sport
    const playersRes = await fetch(
      `${origin}/api/v2/players?sport_id=${swimSport.id}`,
      {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      },
    );
    if (!playersRes.ok) return null;

    const playersBody = await playersRes.json();
    const players: SidearmPlayer[] = Array.isArray(playersBody)
      ? playersBody
      : (playersBody?.data ?? playersBody?.players ?? []);

    return players.length > 0 ? players : null;
  } catch {
    // Timeout, network error, or non-JSON response -- not a SIDEARM site
    return null;
  }
}

// ── Main handler ───────────────────────────────────────────────────
export async function GET(request: Request) {
  // Verify Vercel Cron secret when running in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startTime = Date.now();
  console.log("[api/update] Roster update cron started");

  const supabase = getSupabase();
  const results: UpdateResult[] = [];
  const STALE_DAYS = 7;
  const MAX_TEAMS_PER_RUN = 10;

  try {
    // ── 1. Fetch all teams from the DB ────────────────────────────
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: true, nullsFirst: true });

    if (teamsError || !teams) {
      console.error("[api/update] Failed to fetch teams:", teamsError?.message);
      return NextResponse.json(
        { error: "Failed to fetch teams", detail: teamsError?.message },
        { status: 500 },
      );
    }

    console.log(`[api/update] Found ${teams.length} teams in database`);

    // ── 2. Find stale teams ───────────────────────────────────────
    const staleTeams: Array<TeamRow & { rosterUrl: string }> = [];

    for (const team of teams as TeamRow[]) {
      if (!isStale(team.updated_at, STALE_DAYS)) continue;

      // Match DB team to our roster URL list
      const entry = ROSTER_URLS.find(
        (r) => r.teamName.toLowerCase() === team.name.toLowerCase(),
      );
      if (entry) {
        staleTeams.push({ ...team, rosterUrl: entry.url });
      }
    }

    console.log(
      `[api/update] ${staleTeams.length} stale teams (>${STALE_DAYS} days), processing up to ${MAX_TEAMS_PER_RUN}`,
    );

    if (staleTeams.length === 0) {
      await writeSyncLog(supabase, "success", 0, null);
      return NextResponse.json({
        message: "All teams are up to date",
        staleCount: 0,
        results: [],
        durationMs: Date.now() - startTime,
      });
    }

    // ── 3. Process stale teams (oldest first, capped) ─────────────
    const batch = staleTeams.slice(0, MAX_TEAMS_PER_RUN);

    for (const team of batch) {
      try {
        console.log(`[api/update] Processing ${team.name}...`);

        // Try the SIDEARM JSON API first (fast, no browser needed)
        const players = await fetchSidearmRoster(team.rosterUrl);

        if (!players) {
          // Can't scrape without Playwright -- mark for manual update
          console.log(
            `[api/update] ${team.name}: SIDEARM API unavailable, needs manual scrape`,
          );
          results.push({
            team: team.name,
            teamId: team.id,
            status: "sidearm_unavailable",
            athleteCount: 0,
          });

          // Still bump updated_at so we don't retry every run --
          // the team will come back around in STALE_DAYS
          await supabase
            .from("teams")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", team.id);

          continue;
        }

        // ── Upsert athletes from SIDEARM data ────────────────────
        let upsertCount = 0;

        for (const player of players) {
          const name =
            player.full_name ??
            [player.first_name, player.last_name].filter(Boolean).join(" ");

          if (!name || name.trim().length < 2) continue;

          const classYear = mapClassYear(
            player.academic_year_display ?? player.academic_year ?? "",
          );

          const position = (player.position ?? "").toLowerCase();
          const athleteType: "swimmer" | "diver" = position.includes("div")
            ? "diver"
            : "swimmer";

          const photoUrl = player.headshot_url ?? player.roster_image ?? null;

          const { error: upsertError } = await supabase.from("athletes").upsert(
            {
              name: name.trim(),
              team_id: team.id,
              athlete_type: athleteType,
              class_year: classYear,
              hometown: player.hometown ?? null,
              photo_url: photoUrl,
              is_archived: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "team_id,name" },
          );

          if (!upsertError) upsertCount++;
        }

        // Mark athletes not in this batch as potentially archived
        // (we skip this for safety -- manual review is better)

        // Update team timestamp
        await supabase
          .from("teams")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", team.id);

        console.log(
          `[api/update] ${team.name}: upserted ${upsertCount}/${players.length} athletes`,
        );

        results.push({
          team: team.name,
          teamId: team.id,
          status: "updated",
          athleteCount: upsertCount,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[api/update] ${team.name} failed:`, msg);
        results.push({
          team: team.name,
          teamId: team.id,
          status: "failed",
          athleteCount: 0,
          error: msg,
        });
      }
    }

    // ── 4. Write sync log ─────────────────────────────────────────
    const totalUpdated = results.filter((r) => r.status === "updated").length;
    const totalFailed = results.filter((r) => r.status === "failed").length;
    const totalSidearmUnavailable = results.filter(
      (r) => r.status === "sidearm_unavailable",
    ).length;
    const totalAthletes = results.reduce((sum, r) => sum + r.athleteCount, 0);

    const hasErrors = totalFailed > 0;
    const errorMsg = hasErrors
      ? `${totalFailed} team(s) failed. ${totalSidearmUnavailable} need manual scrape.`
      : totalSidearmUnavailable > 0
        ? `${totalSidearmUnavailable} team(s) need manual scrape (SIDEARM API unavailable).`
        : null;

    await writeSyncLog(
      supabase,
      hasErrors ? "error" : "success",
      totalAthletes,
      errorMsg,
    );

    const durationMs = Date.now() - startTime;
    console.log(`[api/update] Complete in ${durationMs}ms`, {
      totalUpdated,
      totalFailed,
      totalSidearmUnavailable,
      totalAthletes,
    });

    return NextResponse.json({
      message: "Roster update complete",
      staleCount: staleTeams.length,
      processedCount: batch.length,
      remainingStale: Math.max(0, staleTeams.length - MAX_TEAMS_PER_RUN),
      summary: {
        updated: totalUpdated,
        failed: totalFailed,
        sidearmUnavailable: totalSidearmUnavailable,
        totalAthletes,
      },
      results,
      durationMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/update] Fatal error:", msg);

    try {
      await writeSyncLog(supabase, "error", 0, msg);
    } catch {
      // ignore logging failures on fatal error
    }

    return NextResponse.json(
      { error: "Internal server error", detail: msg },
      { status: 500 },
    );
  }
}

// ── Sync log helper ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeSyncLog(
  supabase: ReturnType<typeof createClient<any>>,
  status: "success" | "error",
  recordsCount: number,
  errorMessage: string | null,
) {
  const { error } = await supabase.from("swim_sync_log").insert({
    sync_type: "roster_cron",
    source: "api/update",
    records_count: recordsCount,
    status,
    error_message: errorMessage,
  });
  if (error) {
    console.error("[api/update] Failed to write sync log:", error.message);
  }
}
