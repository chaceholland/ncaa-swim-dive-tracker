// Team-name → slug mapping, extracted from lib/swimcloud.ts so server-only
// code (app/api/headshots) can reuse the exact same logic without importing
// lib/swimcloud.ts, which instantiates a browser (anon) Supabase client at
// module load. lib/swimcloud.ts re-exports teamNameToSlug for its callers.

// Some teams use a non-standard slug in swim_teams that doesn't
// match the simple hyphenated form of their name.
export const TEAM_SLUG_OVERRIDES: Record<string, string> = {
  virginia: "uva",
  // "Texas A&M" naively slugifies to "texas-a-m", but the swim slug is
  // "texas-am". Without this the athletes→swim slug wouldn't line up.
  "texas-a-m": "texas-am",
};

/** Naive slug: lowercase, non-alphanumerics collapsed to single hyphens. */
export function naiveTeamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function teamNameToSlug(name: string): string {
  const slug = naiveTeamSlug(name);
  return TEAM_SLUG_OVERRIDES[slug] ?? slug;
}
