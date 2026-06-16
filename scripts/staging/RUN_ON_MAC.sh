#!/usr/bin/env bash
# Mac-runnable one-shot for the swim Pass 1 / Chunk A staging import.
# Meet ID 351190 (NCAA D1 Men's Championships 2026).
#
# What this script does, in order:
#   1. Verifies Playwright + chromium are installed (one-time).
#   2. Runs a DRY-RUN against meet 351190, dumps parsed JSON for review.
#   3. Stops. You inspect the dry-run output, then re-run with APPLY=1.
#
# Nothing here writes to live `swim_meets` / `swim_individual_results` /
# `athletes` / `teams`. Apply step writes only to the staging tables created
# by 001_create_ncaa_champs_staging.sql — run that DDL once before APPLY=1.
#
# Usage:
#   cd ~/Desktop/ncaa-swim-dive-tracker
#   bash scripts/staging/RUN_ON_MAC.sh            # dry-run only
#   APPLY=1 bash scripts/staging/RUN_ON_MAC.sh    # dry-run THEN apply to staging

set -euo pipefail
cd "$(dirname "$0")/../.."

MEET_ID="${MEET_ID:-351190}"
APPLY="${APPLY:-0}"

echo "› Verifying Playwright + chromium…"
if ! node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  echo "  installing playwright"
  npm install --save-dev playwright
fi
npx --yes playwright install chromium >/dev/null

echo "› Loading Supabase creds from .env.local / .env (if present)…"
set +u
[ -f .env.local ] && set -a && source .env.local && set +a
[ -f .env       ] && set -a && source .env       && set +a
set -u

echo "› DRY-RUN (no DB writes) for meet $MEET_ID"
node scripts/staging/import-ncaa-champs-2026.mjs --dry-run --json --meet-id="$MEET_ID"

if [ "$APPLY" = "1" ]; then
  if [ -z "${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "✗ APPLY requested but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Aborting."
    exit 2
  fi
  echo "› APPLY: writing to staging tables only"
  node scripts/staging/import-ncaa-champs-2026.mjs --apply --meet-id="$MEET_ID"
else
  cat <<'EOF'

› Dry-run complete. Inspect scripts/staging/dry-run-meet-351190.json.
› When ready, re-run with:
    APPLY=1 bash scripts/staging/RUN_ON_MAC.sh
EOF
fi
