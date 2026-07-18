// Token-guarded headshot ingest for the CSD Chrome extension.
//
// Replaces the extension's old direct PATCH against the `csd_athletes` view,
// which had been a silent no-op since 2026-03-04: that view is a
// security_invoker view over swim_athletes, so anon-key writes matched 0 rows
// while PostgREST still returned 204 (the extension logged SUCCESS anyway).
//
// The extension now POSTs here with a shared secret; this route holds the
// service-role key server-side and writes `athletes.photo_url` directly,
// returning truthful matched/updated counts so unmatched names are visible.
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { naiveTeamSlug, teamNameToSlug } from "@/lib/teamSlug";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_UPDATES_PER_REQUEST = 500;

// The extension fetches cross-origin from a chrome-extension:// origin, so the
// preflight needs to pass. Safe to allow any origin: every request must still
// carry the bearer secret, and no cookies/credentials are involved.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ── Supabase (server-side, service role) ───────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service role only — no anon fallback (anon is SELECT-only under RLS and
  // would make every update a silent no-op, which is the bug we're fixing).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

// ── Types ──────────────────────────────────────────────────────────
interface HeadshotUpdate {
  name: string;
  photo_url: string;
}

interface HeadshotPayload {
  team?: unknown;
  updates?: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Build slug → team-uuid from the live `teams` table using the same
 * teamNameToSlug/TEAM_SLUG_OVERRIDES logic the app uses.
 *
 * The naive (pre-override) slug is registered as an alias too, because the
 * extension's team ids predate the overrides: it sends `virginia` where
 * teamNameToSlug("Virginia") yields `uva`. Aliases never clobber a canonical
 * slug already claimed by another team.
 */
function buildSlugIndex(teams: Array<{ id: string; name: string }>) {
  const canonical = new Map<string, { id: string; name: string }>();
  const alias = new Map<string, { id: string; name: string }>();

  for (const team of teams) {
    canonical.set(teamNameToSlug(team.name), team);
  }
  for (const team of teams) {
    const naive = naiveTeamSlug(team.name);
    if (!canonical.has(naive) && !alias.has(naive)) alias.set(naive, team);
  }

  return (slug: string) => canonical.get(slug) ?? alias.get(slug) ?? null;
}

/** Escape PostgREST ilike wildcards so a name matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (c) => `\\${c}`);
}

function parseUpdates(raw: unknown): {
  updates: HeadshotUpdate[];
  invalid: number;
} {
  if (!Array.isArray(raw)) return { updates: [], invalid: 0 };

  const updates: HeadshotUpdate[] = [];
  let invalid = 0;

  for (const item of raw) {
    const name =
      typeof (item as HeadshotUpdate)?.name === "string"
        ? (item as HeadshotUpdate).name.trim()
        : "";
    const photoUrl =
      typeof (item as HeadshotUpdate)?.photo_url === "string"
        ? (item as HeadshotUpdate).photo_url.trim()
        : "";

    if (!name || !/^https?:\/\//i.test(photoUrl)) {
      invalid++;
      continue;
    }
    updates.push({ name, photo_url: photoUrl });
  }

  return { updates, invalid };
}

// ── Main handler ───────────────────────────────────────────────────
export async function POST(request: Request) {
  // Shared-secret guard, same shape as the CRON_SECRET check in api/update.
  // Difference on purpose: this one is mandatory. If HEADSHOT_SECRET is unset
  // we refuse the request rather than leaving a write endpoint wide open.
  // The secret itself is never logged or echoed.
  const headshotSecret = process.env.HEADSHOT_SECRET;
  if (!headshotSecret) {
    console.error("[api/headshots] HEADSHOT_SECRET is not configured");
    return json({ error: "Endpoint not configured" }, 503);
  }
  if (request.headers.get("authorization") !== `Bearer ${headshotSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: HeadshotPayload;
  try {
    payload = (await request.json()) as HeadshotPayload;
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }

  const slug = typeof payload.team === "string" ? payload.team.trim() : "";
  if (!slug) {
    return json({ error: "Missing required field: team (a team slug)" }, 400);
  }

  if (!Array.isArray(payload.updates)) {
    return json(
      { error: "Missing required field: updates (array of {name, photo_url})" },
      400,
    );
  }

  const { updates, invalid } = parseUpdates(payload.updates);
  if (updates.length > MAX_UPDATES_PER_REQUEST) {
    return json(
      {
        error: `Too many updates: ${updates.length} (max ${MAX_UPDATES_PER_REQUEST})`,
      },
      413,
    );
  }

  const supabase = getSupabase();

  // ── Resolve slug → teams.id server-side ─────────────────────────
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name");

  if (teamsError || !teams) {
    console.error("[api/headshots] Failed to load teams:", teamsError?.message);
    return json(
      { error: "Failed to load teams", detail: teamsError?.message },
      500,
    );
  }

  const team = buildSlugIndex(teams as Array<{ id: string; name: string }>)(
    slug,
  );
  if (!team) {
    return json({ error: "Unknown team slug", team: slug }, 404);
  }

  // ── Apply updates ────────────────────────────────────────────────
  const unmatched: string[] = [];
  const errors: Array<{ name: string; error: string }> = [];
  let matched = 0;

  for (const update of updates) {
    const patch = {
      photo_url: update.photo_url,
      updated_at: new Date().toISOString(),
    };

    // Exact name match first; .select() makes the row count truthful.
    let { data: rows, error } = await supabase
      .from("athletes")
      .update(patch)
      .eq("team_id", team.id)
      .eq("name", update.name)
      .select("id");

    // Fall back to a case-insensitive exact match (no wildcards) — roster
    // pages vary in casing. Still an exact-string comparison, not fuzzy.
    if (!error && (rows?.length ?? 0) === 0) {
      ({ data: rows, error } = await supabase
        .from("athletes")
        .update(patch)
        .eq("team_id", team.id)
        .ilike("name", escapeLike(update.name))
        .select("id"));
    }

    if (error) {
      errors.push({ name: update.name, error: error.message });
      continue;
    }

    const count = rows?.length ?? 0;
    if (count === 0) unmatched.push(update.name);
    else matched += count;
  }

  console.log(
    `[api/headshots] ${team.name} (${slug}): received ${updates.length}, matched ${matched}, unmatched ${unmatched.length}, errors ${errors.length}`,
  );

  return json({
    team: slug,
    teamId: team.id,
    teamName: team.name,
    received: updates.length,
    skippedInvalid: invalid,
    matched,
    updated: matched,
    unmatched,
    errors,
  });
}
