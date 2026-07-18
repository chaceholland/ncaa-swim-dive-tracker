// Shared service-role Supabase client for the tsx maintenance scripts.
//
// Every write path under scripts/ targets the canonical `athletes` / `teams`
// tables, which have RLS enabled with a SELECT-only policy for anon. Writing
// with NEXT_PUBLIC_SUPABASE_ANON_KEY does not error — PostgREST just matches
// 0 rows and returns success — so anon-key scripts fail silently. They must
// use the service-role key.
//
// The key is never hardcoded: it is read from .env.local / the process env,
// following the convention in scripts/staging/*.mjs.
//
// Two env var names are accepted for that one privileged key:
//   SUPABASE_SECRET_KEY        — current name (Supabase's `sb_secret_…` format)
//   SUPABASE_SERVICE_ROLE_KEY  — legacy alias, kept for older checkouts/CI
// These are aliases for the SAME credential, not a privilege ladder. Vercel
// carries the former; some local envs still carry the latter.
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Loaded once per process, relative to the repo root (npm run <script> cwd).
// Does not override variables already present in the environment.
config({ path: ".env.local", quiet: true });

/**
 * Build a service-role Supabase client, or throw loudly if creds are missing.
 * Never falls back to the anon key — a silent no-op is worse than a crash.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // `||` (not `??`) on purpose: an env var present but set to "" should fall
  // through to the alias rather than resolve to an empty key.
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL — add it to .env.local",
    );
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or its legacy alias " +
        "SUPABASE_SERVICE_ROLE_KEY) — set one in .env.local. " +
        "This script writes to RLS-protected tables; the anon/publishable " +
        "key would silently update 0 rows, so there is no fallback to it.",
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
