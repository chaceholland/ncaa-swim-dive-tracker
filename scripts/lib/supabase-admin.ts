// Shared service-role Supabase client for the tsx maintenance scripts.
//
// Every write path under scripts/ targets the canonical `athletes` / `teams`
// tables, which have RLS enabled with a SELECT-only policy for anon. Writing
// with NEXT_PUBLIC_SUPABASE_ANON_KEY does not error — PostgREST just matches
// 0 rows and returns success — so anon-key scripts fail silently. They must
// use the service-role key.
//
// The JWT is never hardcoded: it is read from .env.local / the process env,
// following the convention in scripts/staging/*.mjs.
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL — add it to .env.local",
    );
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local. " +
        "This script writes to RLS-protected tables; the anon key would " +
        "silently update 0 rows.",
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
