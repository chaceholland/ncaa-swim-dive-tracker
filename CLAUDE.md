# NCAA Swim & Dive Tracker

_Project instructions for Claude Code. Global rules: `~/.claude/CLAUDE.md`. Deep reference: `~/claude-shared/memory/`._

**Purpose:** NCAA D1 **Men's** Swimming & Diving — athletes, individual results, teams (~52 D1 teams). Repo: `chaceholland/ncaa-swim-dive-tracker`.

**Stack:** Next.js 16.1.6 + React 19. Vercel + Cron. Supabase P1 `dtnozcqkuzhjmjvsfjqk`.

**Data:** `swim_athletes`, `swim_individual_results` (~114k rows), `swim_teams`.

**Cron (`vercel.json`):** `/api/update` @ 04:00 **Monday (weekly)**. **API/scripts:** `app/api/`, `scripts/`.

**Conventions & gotchas:**
- Scraping: **SIDEARM JSON API** for cron; **Playwright** for manual runs. Use the **athlete-scraper** skill + `scrape_template.py`.
- Scripts: `scrape-athletes`, `scrape-athletes-v2`, `fetch-espn-logos`, `download-logos`, `upgrade-images`, `rescrape`, `migrate`.
- Headshots/logos → **Supabase Storage** (never local paths). `service_role` server-side env only; auto-deploy on verified fix.
