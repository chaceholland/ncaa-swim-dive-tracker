import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
// @ts-ignore — plain JS ESM module
import { requireInSeason } from "../_lib/seasonGuard.js";
// @ts-ignore — plain JS ESM module (no .d.ts); soft-disabled until NTFY_TOPIC is set
import { alert, shouldAlertWarn } from "../_lib/alert.js";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ── Supabase (server-side, service role) ───────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Privileged key only. There is deliberately no anon-key fallback: `athletes`
  // and `teams` are RLS-protected with a SELECT-only anon policy, so an anon
  // client would return success while writing 0 rows — a silent no-op cron.
  //
  // SUPABASE_SECRET_KEY is the current name for that key; SUPABASE_SERVICE_ROLE_KEY
  // is a legacy alias for the same credential. `||` so an empty value falls through.
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or its legacy alias SUPABASE_SERVICE_ROLE_KEY) " +
        "— the roster cron cannot write without it",
    );
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
  /** Departures archived for this team this run. */
  archived?: number;
  /** Names of the athletes archived, for the run log. */
  archivedNames?: string[];
  /** Previously-archived athletes back on the roster (the upsert un-archived them). */
  unarchived?: number;
  /** Set when a safety guard blocked archiving for this team. */
  archiveGuard?: ArchiveGuard;
  archiveGuardDetail?: string;
}

/** Supabase admin client handle. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = ReturnType<typeof createClient<any>>;

/** Identity of one athlete on a freshly scraped roster, source-agnostic. */
interface ScrapedIdentity {
  /**
   * Swimcloud id when the roster source supplies one. The SIDEARM player payload
   * does NOT, so today this is always null and matching falls through to the
   * normalized name; the field exists so a Swimcloud-sourced caller gets the
   * stronger key for free.
   */
  swimcloudId: string | null;
  name: string;
}

/** Pre-refresh snapshot of one `athletes` row. */
interface ExistingAthlete {
  id: string;
  name: string;
  swimcloud_id: string | null;
  is_archived: boolean | null;
}

type ArchiveGuard =
  | "empty_scrape"
  | "partial_scrape"
  | "cap_exceeded"
  | "snapshot_unavailable"
  | "update_failed";

interface ReconcileOutcome {
  scrapedCount: number;
  /** DB rows for this team found on the scraped roster. */
  matched: number;
  archived: number;
  archivedNames: string[];
  unarchived: number;
  guard: ArchiveGuard | null;
  guardDetail: string | null;
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

// ── Departure reconciliation (graduations / transfers) ─────────────
//
// An athlete who is no longer on their team's freshly scraped roster has left
// the program -- graduated, transferred, or quit. They are ARCHIVED, never
// deleted: `swim_individual_results` joins meet history on
// `athletes.swimcloud_id`, so deleting a departed athlete would orphan every
// result they ever swam. `is_archived = true` drops them out of the tracker's
// views (`app/search/page.tsx` and `app/team/[id]/page.tsx` both filter
// `.eq("is_archived", false)`) while the row and its results stay intact, and
// the upsert above writes `is_archived: false`, so an athlete who reappears on
// a roster un-archives automatically. Reconciliation is therefore reversible in
// both directions.
//
// A transfer is indistinguishable from a graduation from one team's point of
// view -- both are "gone from this roster". Both archive here; the transfer
// un-archives when the new team's roster is scraped.

/**
 * A scrape returning fewer than this share of a team's pre-refresh active
 * athletes is treated as partial/failed and archives nothing.
 */
const ARCHIVE_MIN_ROSTER_RATIO = 0.5;

/** Hard ceiling on departures archived for one team in one run. */
const ARCHIVE_MAX_PER_TEAM = 30;

/**
 * Identity key for name matching: lowercased, accent-stripped, punctuation-free,
 * token-sorted. Sorting the tokens makes "Schmidt, Danny" and "Danny Schmidt"
 * the same key.
 *
 * This is deliberately LOOSER than the upsert's exact `onConflict:
 * "team_id,name"` match. The bias is intentional and one-directional: a
 * formatting-only difference must never read as a departure. The cost of being
 * too loose is a stale row left active (harmless, visible, fixable); the cost of
 * being too strict is archiving an athlete who is still on the team.
 */
function normalizeName(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritics
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * Compare a team's freshly scraped roster against its pre-refresh DB rows and
 * archive the athletes who are no longer on it.
 *
 * `existing` must be the snapshot taken BEFORE the upsert loop ran, for two
 * reasons: the upsert un-archives returning athletes (so an after-snapshot can
 * no longer tell a returner from a steady-state athlete), and the partial-scrape
 * guard has to measure against the pre-refresh active count.
 *
 * Never deletes. Never touches results tables. Returns without writing anything
 * if any guard trips.
 */
async function reconcileDepartures(
  supabase: SupabaseAdminClient,
  teamName: string,
  existing: ExistingAthlete[] | null,
  scraped: ScrapedIdentity[],
): Promise<ReconcileOutcome> {
  const base: ReconcileOutcome = {
    scrapedCount: scraped.length,
    matched: 0,
    archived: 0,
    archivedNames: [],
    unarchived: 0,
    guard: null,
    guardDetail: null,
  };

  // ── GUARD 1: empty scrape ────────────────────────────────────────
  // A site outage, a changed API shape, or a sport-id miss all surface as zero
  // rows. Archiving on that would wipe an entire roster out of the tracker.
  if (scraped.length === 0) {
    const guardDetail = "scrape returned 0 athletes";
    console.warn(
      `[api/update] ${teamName}: SKIPPING departure archive — ${guardDetail}`,
    );
    return { ...base, guard: "empty_scrape", guardDetail };
  }

  // No snapshot => no safe basis for comparison. Refresh still succeeded.
  if (!existing) {
    const guardDetail = "pre-refresh roster snapshot unavailable";
    console.warn(
      `[api/update] ${teamName}: SKIPPING departure archive — ${guardDetail}`,
    );
    return { ...base, guard: "snapshot_unavailable", guardDetail };
  }

  const activeBefore = existing.filter((a) => !a.is_archived);

  // ── GUARD 2: partial scrape ──────────────────────────────────────
  // A roster that half-loaded (pagination cut short, men's/women's split
  // mis-parsed) returns a plausible-looking but truncated list. Anything under
  // half the known active roster is treated as a bad scrape, not 20 departures.
  if (
    activeBefore.length > 0 &&
    scraped.length < activeBefore.length * ARCHIVE_MIN_ROSTER_RATIO
  ) {
    const guardDetail =
      `scraped ${scraped.length} vs ${activeBefore.length} active in DB ` +
      `(under ${Math.round(ARCHIVE_MIN_ROSTER_RATIO * 100)}% — likely a partial scrape)`;
    console.warn(
      `[api/update] ${teamName}: SKIPPING departure archive — ${guardDetail}`,
    );
    return { ...base, guard: "partial_scrape", guardDetail };
  }

  // ── Match the DB against the scraped roster ──────────────────────
  const scrapedIds = new Set<string>();
  const scrapedNameKeys = new Set<string>();
  // Exact trimmed names, mirroring the upsert's `onConflict: "team_id,name"`.
  // Used only to report which archived athletes the upsert actually un-archived.
  const scrapedExactNames = new Set<string>();
  for (const s of scraped) {
    if (s.swimcloudId) scrapedIds.add(s.swimcloudId);
    const key = normalizeName(s.name);
    if (key) scrapedNameKeys.add(key);
    const exact = s.name.trim();
    if (exact) scrapedExactNames.add(exact);
  }

  /** Prefer swimcloud_id; fall back to normalized name. Either match keeps them. */
  const isOnRoster = (a: ExistingAthlete): boolean => {
    if (a.swimcloud_id && scrapedIds.has(a.swimcloud_id)) return true;
    const key = normalizeName(a.name);
    return key.length > 0 && scrapedNameKeys.has(key);
  };

  const departed: ExistingAthlete[] = [];
  let matched = 0;
  let unarchived = 0;

  for (const a of existing) {
    if (isOnRoster(a)) {
      matched++;
      // Archived before the refresh and back on the roster now. The upsert
      // already flipped is_archived to false for the ones it key-matched
      // exactly; count those, so the number reflects real writes.
      if (a.is_archived && scrapedExactNames.has(a.name)) unarchived++;
      continue;
    }
    // Already-archived athletes who are still gone need no write.
    if (!a.is_archived) departed.push(a);
  }

  // ── GUARD 3: implausible departure count ─────────────────────────
  // Past the ratio guard, a large departure list usually means a systematic
  // mismatch (a site that reformatted every name) rather than real attrition.
  // Skip the whole team rather than archiving a partial subset.
  if (departed.length > ARCHIVE_MAX_PER_TEAM) {
    const guardDetail =
      `${departed.length} departures exceeds the ${ARCHIVE_MAX_PER_TEAM}/team/run cap ` +
      `(scraped ${scraped.length}, ${activeBefore.length} active in DB)`;
    console.warn(
      `[api/update] ${teamName}: SKIPPING departure archive — ${guardDetail}`,
    );
    return { ...base, matched, unarchived, guard: "cap_exceeded", guardDetail };
  }

  if (departed.length === 0) {
    return { ...base, matched, unarchived };
  }

  // ── Archive. UPDATE only -- no delete, no results tables. ────────
  const { error } = await supabase
    .from("athletes")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .in(
      "id",
      departed.map((a) => a.id),
    );

  if (error) {
    const guardDetail = `archive update failed: ${error.message}`;
    console.error(`[api/update] ${teamName}: ${guardDetail}`);
    return { ...base, matched, unarchived, guard: "update_failed", guardDetail };
  }

  return {
    ...base,
    matched,
    unarchived,
    archived: departed.length,
    archivedNames: departed.map((a) => a.name),
  };
}

// ── Main handler ───────────────────────────────────────────────────
export async function GET(request: Request) {
  // Offseason guard
  {
    const url = new URL(request.url);
    const pagesReq = { query: Object.fromEntries(url.searchParams.entries()) };
    let guardResponse: NextResponse | null = null;
    const pagesRes = {
      status(code: number) {
        return {
          json(body: unknown) {
            guardResponse = NextResponse.json(body, { status: code });
          },
        };
      },
    };
    if (
      await requireInSeason(pagesReq, pagesRes, {
        slug: "swim",
        logTable: "swim_sync_log",
      })
    ) {
      return guardResponse!;
    }
  }

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

        // ── Pre-refresh roster snapshot ──────────────────────────
        // Taken BEFORE the upsert: the upsert sets is_archived=false on every
        // scraped athlete, so only a before-snapshot can distinguish a returning
        // athlete from a steady-state one, and only the pre-refresh active count
        // is a valid denominator for the partial-scrape guard.
        const { data: rosterBefore, error: rosterBeforeError } = await supabase
          .from("athletes")
          .select("id, name, swimcloud_id, is_archived")
          .eq("team_id", team.id);

        if (rosterBeforeError) {
          console.warn(
            `[api/update] ${team.name}: roster snapshot read failed (${rosterBeforeError.message}) — ` +
              `refresh continues, departures will not be reconciled this run`,
          );
        }

        // ── Upsert athletes from SIDEARM data ────────────────────
        let upsertCount = 0;
        // Identity of every athlete accepted from this scrape. Built inside the
        // same loop so it is exactly the set the upsert considered -- including
        // rows whose upsert errored, since those athletes are still on the real
        // roster and must never be read as departures.
        const scrapedIdentities: ScrapedIdentity[] = [];

        for (const player of players) {
          const name =
            player.full_name ??
            [player.first_name, player.last_name].filter(Boolean).join(" ");

          if (!name || name.trim().length < 2) continue;

          // SIDEARM supplies no Swimcloud id -- matching falls back to the name.
          scrapedIdentities.push({ swimcloudId: null, name: name.trim() });

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

        // ── Reconcile departures (graduations / transfers) ───────
        // Athletes on this team who are NOT on the roster we just scraped have
        // left the program. Archive them (reversible, results preserved) so they
        // drop out of the tracker's views. Guarded against flaky scrapes; see
        // reconcileDepartures.
        const reconcile = await reconcileDepartures(
          supabase,
          team.name,
          rosterBeforeError ? null : ((rosterBefore ?? []) as ExistingAthlete[]),
          scrapedIdentities,
        );

        // Update team timestamp
        await supabase
          .from("teams")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", team.id);

        console.log(
          `[api/update] ${team.name}: upserted ${upsertCount}/${players.length} athletes`,
        );
        console.log(
          `[api/update] ${team.name}: reconcile — scraped ${reconcile.scrapedCount}, ` +
            `matched ${reconcile.matched}, un-archived ${reconcile.unarchived}, ` +
            `newly archived ${reconcile.archived}` +
            (reconcile.archived > 0
              ? ` (${reconcile.archivedNames.join(", ")})`
              : "") +
            (reconcile.guard
              ? ` — GUARD ${reconcile.guard}: ${reconcile.guardDetail}`
              : ""),
        );

        results.push({
          team: team.name,
          teamId: team.id,
          status: "updated",
          athleteCount: upsertCount,
          archived: reconcile.archived,
          archivedNames: reconcile.archivedNames,
          unarchived: reconcile.unarchived,
          ...(reconcile.guard
            ? {
                archiveGuard: reconcile.guard,
                archiveGuardDetail: reconcile.guardDetail ?? undefined,
              }
            : {}),
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
    const totalArchived = results.reduce((sum, r) => sum + (r.archived ?? 0), 0);
    const totalUnarchived = results.reduce(
      (sum, r) => sum + (r.unarchived ?? 0),
      0,
    );
    // A tripped guard means departures went UNarchived for that team -- a silent
    // skip, so surface it rather than letting it vanish into the run log.
    const archiveGuardTrips = results
      .filter((r) => r.archiveGuard)
      .map((r) => `${r.team}: ${r.archiveGuard}`);

    const hasErrors = totalFailed > 0;
    const noteParts: string[] = [];
    if (hasErrors) {
      noteParts.push(
        `${totalFailed} team(s) failed. ${totalSidearmUnavailable} need manual scrape.`,
      );
    } else if (totalSidearmUnavailable > 0) {
      noteParts.push(
        `${totalSidearmUnavailable} team(s) need manual scrape (SIDEARM API unavailable).`,
      );
    }
    if (archiveGuardTrips.length > 0) {
      noteParts.push(
        `Departure archive skipped for ${archiveGuardTrips.length} team(s) — ${archiveGuardTrips.join("; ")}.`,
      );
    }
    const errorMsg = noteParts.length > 0 ? noteParts.join(" ") : null;

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
      totalArchived,
      totalUnarchived,
      archiveGuardTrips: archiveGuardTrips.length,
    });

    const alertSummary = {
      attempted: results.length,
      ok: totalUpdated,
      failed: totalFailed,
      sidearmUnavailable: totalSidearmUnavailable,
      athletes: totalAthletes,
      archived: totalArchived,
      archiveGuardTrips,
    };
    if (shouldAlertWarn(alertSummary)) {
      await alert("warn", alertSummary);
    }

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
        totalArchived,
        totalUnarchived,
        archiveGuardTrips,
      },
      results,
      durationMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/update] Fatal error:", msg);
    await alert("error", { message: msg });

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
