# Swim staging area

Net-new tables and import scripts that **do not touch the live `swim_*`, `athletes`, or `teams` tables**. Land scraped data here first, diff it against production, then run a separate cutover migration.

## Files

- `001_create_ncaa_champs_staging.sql` — DDL for `swim_staging_ncaa_champs_2026_meet` and `_results`. Additive only. Apply with the curl block below.
- `import-ncaa-champs-2026.mjs` — **canonical importer.** Uses Playwright (matches `archive/scripts/scrape-swimcloud-season.js`). Defaults to NCAA Men's D1 Championships meet id **351190**. `--dry-run` parses + reports, `--apply` writes to staging only, `--json` dumps the parsed structure for diffing.
- `import-ncaa-champs-2026.ts` — **deprecated**, kept for diff context only. Assumed a Swimcloud JSON API that doesn't exist; Cloudflare 403s the sandbox.
- `probe-ncaa-champs-2026.mjs` — quick HEAD/fetch probe used while triaging. Confirms Cloudflare blocks bare HTTP. Run on the Mac it'll still 403 unless headless Chrome is used (the importer handles that).

## Run order on the Mac (confirmed meet id 351190)

```bash
# 1) Optional one-time: install Playwright + chromium if not already
cd ~/Desktop/ncaa-swim-dive-tracker
npm install playwright            # if missing
npx playwright install chromium

# 2) Apply the staging DDL (one-time, additive, safe)
PROJECT_REF=dtnozcqkuzhjmjvsfjqk
curl -sS -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "User-Agent: supabase-cli/2.93.0" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'query': sys.stdin.read()}))" < scripts/staging/001_create_ncaa_champs_staging.sql)"

# 3) Dry-run the import (parses the meet, prints event/row counts, NO DB writes)
node scripts/staging/import-ncaa-champs-2026.mjs --dry-run --json

# 4) Apply to STAGING tables only (still does not touch live swim_meets / swim_individual_results)
set -a; source .env.local 2>/dev/null || source .env; set +a    # pulls SUPABASE_URL + SERVICE_ROLE
node scripts/staging/import-ncaa-champs-2026.mjs --apply
```

Cutover from staging → live `swim_meets` / `swim_individual_results` is a **separate, approval-gated step**. Don't skip the dry-run.

## Why two scripts existed

`import-ncaa-champs-2026.ts` was drafted first under the assumption that Swimcloud exposed a JSON `api/v1/...` endpoint. Live probing from a sandbox revealed Cloudflare's bot challenge — only the rendered HTML route works. The `.mjs` file mirrors the proven Playwright pattern used elsewhere in the repo.

## Sandbox limitations

The resume-session sandbox cannot reach Swimcloud at all (Cloudflare 403 on every URL). All scraping has to run on Chace's Mac. The DDL and apply steps work from anywhere with `SUPABASE_ACCESS_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY`.
