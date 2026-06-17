# Swimcloud roster refresh (men's D1)

How to (re)fill / refresh the live `athletes` roster the app reads. **Source = Swimcloud**, not the SIDEARM school sites (those Cloudflare-block non-browser fetches) and not ESPN (it has no swimming sport at all).

Swimcloud is a single Cloudflare domain, so one human "verify you are human" click clears it for the whole run; same-origin `fetch()` then carries the clearance to every team page. `swim_teams.swimcloud_id` holds the **men's** team id; roster URL = `https://www.swimcloud.com/team/{swimcloud_id}/roster/`.

## Step 1 — scrape rosters in a real browser (Claude in Chrome)

Open `https://www.swimcloud.com/team/34/roster/`, clear the Cloudflare check once, then run this in the page console (or via the Chrome MCP `javascript_tool`). Build `teams` from `swim_teams` (swimcloud_id → the matching app `teams.name`):

```js
window.__rost = [];
const teams = [ {sc:"34",team:"Georgia Tech"}, /* ...all teams with a swimcloud_id... */ ];
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const t of teams) {
  const html = await (await fetch(`/team/${t.sc}/roster/`, {credentials:"include"})).text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const r of doc.querySelectorAll("table tbody tr")) {
    const td = [...r.querySelectorAll("td")], link = r.querySelector('a[href*="/swimmer/"]');
    if (!link) continue;
    const id = (link.getAttribute("href").match(/swimmer\/(\d+)/)||[])[1];
    const name = link.innerText.replace(/\s+/g," ").trim();
    if (id && name) window.__rost.push({team:t.team, sid:id, name, hometown:(td[2]?.innerText||"").replace(/\s+/g," ").trim(), cls:(td[3]?.innerText||"").trim()});
  }
  await sleep(250);
}
// download to ~/Downloads
const a = document.createElement("a");
a.href = URL.createObjectURL(new Blob([JSON.stringify(window.__rost)], {type:"application/json"}));
a.download = "swimcloud-rosters.json"; document.body.appendChild(a); a.click();
```

Notes: roster table columns are `# | Name (/swimmer/{id}) | Hometown | Class`. Class is FR/SO/JR/SR/GR. Team ids are gender-specific, so no gender filtering is needed.

## Step 2 — apply to live

```bash
cd ~/Desktop/ncaa-swim-dive-tracker
node scripts/staging/swimcloud-roster-apply.mjs ~/Downloads/swimcloud-rosters.json            # dry-run
node scripts/staging/swimcloud-roster-apply.mjs ~/Downloads/swimcloud-rosters.json --apply     # write
```
Fills empty hometown/class on name-matched swimmers; inserts new ones (lastname+first-initial dedup guard, `athlete_type=swimmer`). Never overwrites non-empty fields. Uses `.env.local` `SUPABASE_SERVICE_ROLE_KEY`.

## Step 3 — refresh cached counts

```sql
UPDATE teams t SET athlete_count = sub.n, updated_at = now()
FROM (SELECT team_id, count(*) n FROM athletes WHERE COALESCE(is_archived,false)=false GROUP BY team_id) sub
WHERE sub.team_id = t.id;
```

## 2026-06-17 run

All 46 teams with a swimcloud_id scraped (1,537 athletes). Applied: 287 fills (266 hometowns, 56 classes) + 329 new swimmers (81 dedup-skipped). `athletes` 1,548 → 1,877; teams <18 athletes 1 → 0; Georgia Tech 16 → 30; missing hometowns 366 → 100.

Caveats: 7 teams have no swimcloud_id yet (Duke, Southern Illinois, Boston College, TCU, Columbia, Cal, Utah). UNLV's old app roster was archived (`is_archived=true`) and replaced with the current Swimcloud roster. The `athletes` ↔ `swim_athletes` consolidation is still open.
