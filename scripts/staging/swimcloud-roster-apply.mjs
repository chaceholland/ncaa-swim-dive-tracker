// Swimcloud roster refresh — apply a scraped roster JSON to the live `athletes` table.
//
// Usage (from repo root):
//   node scripts/staging/swimcloud-roster-apply.mjs <rosters.json>           # dry-run (no writes)
//   node scripts/staging/swimcloud-roster-apply.mjs <rosters.json> --apply   # write to live
//
// Input JSON = array of { team: "<app teams.name>", sid, name, hometown, cls } where
// cls is Swimcloud class (FR/SO/JR/SR/GR). Produce it with the browser scrape in
// SWIMCLOUD-ROSTER-REFRESH.md (Swimcloud is one Cloudflare domain — clear it once).
//
// Safety: fills empty hometown/class_year on name-matched athletes only; inserts new
// athletes with a lastname+first-initial dedup guard; never overwrites non-empty fields.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const APPLY = process.argv.includes("--apply");
const JSONP = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "./swimcloud-rosters.json";
const env = {};
try { for (const line of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const i = line.indexOf("="); if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, ""); } } catch {}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
const scraped = JSON.parse(fs.readFileSync(JSONP, "utf8"));
const clsMap = { FR: "freshman", SO: "sophomore", JR: "junior", SR: "senior", GR: "graduate", "5Y": "graduate", GS: "graduate" };
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z\s]/g," ").split(/\s+/).filter(Boolean).sort().join(" ");
const toks = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z\s]/g," ").split(/\s+/).filter(Boolean);
const liKey = s => { const t = toks(s); return t.length ? `${t[t.length-1]}|${t[0][0]}` : null; };
const cleanHome = h => { h = (h||"").trim(); if (!h || /^(Height|Weight)/i.test(h)) return null; return h; };
const { data: teams } = await sb.from("teams").select("id,name").range(0, 999);
const teamByName = new Map(teams.map(t => [t.name.toLowerCase(), t.id]));
let ath = []; for (let from = 0; ; from += 1000) { const { data, error } = await sb.from("athletes").select("id,team_id,name,hometown,class_year").range(from, from + 999); if (error) { console.error("ERR", error.message); process.exit(1); } ath = ath.concat(data || []); if (!data || data.length < 1000) break; }
const byNorm = new Map(), byLi = new Map();
for (const a of ath) { if (!byNorm.has(a.team_id)) { byNorm.set(a.team_id, new Map()); byLi.set(a.team_id, new Set()); } byNorm.get(a.team_id).set(norm(a.name), a); const k = liKey(a.name); if (k) byLi.get(a.team_id).add(k); }
const fills = [], inserts = []; let skipDup = 0, noTeam = 0;
for (const r of scraped) {
  const tid = teamByName.get(String(r.team).toLowerCase()); if (!tid) { noTeam++; continue; }
  const ex = byNorm.get(tid).get(norm(r.name)); const cls = clsMap[String(r.cls||"").toUpperCase()] || null;
  if (ex) { const u = {}; if ((!ex.hometown||!ex.hometown.trim()) && cleanHome(r.hometown)) u.hometown = cleanHome(r.hometown); if ((!ex.class_year||!ex.class_year.trim()) && cls) u.class_year = cls; if (Object.keys(u).length) fills.push({ id: ex.id, ...u }); }
  else { const k = liKey(r.name); if (k && byLi.get(tid).has(k)) { skipDup++; continue; } if (k) byLi.get(tid).add(k); const now = new Date().toISOString(); inserts.push({ id: crypto.randomUUID(), team_id: tid, name: r.name, hometown: cleanHome(r.hometown), class_year: cls, athlete_type: "swimmer", is_archived: false, created_at: now, updated_at: now }); }
}
console.log(`PLAN fills=${fills.length} inserts=${inserts.length} skipped_dups=${skipDup} no_team_match=${noTeam} APPLY=${APPLY}`);
if (!APPLY) { console.log("dry-run only; pass --apply to write."); process.exit(0); }
let f = 0; for (const x of fills) { const { id, ...u } = x; u.updated_at = new Date().toISOString(); const { error } = await sb.from("athletes").update(u).eq("id", id); if (!error) f++; else console.log("fill err", error.message); }
let n = 0; for (let i = 0; i < inserts.length; i += 100) { const c = inserts.slice(i, i + 100); const { error } = await sb.from("athletes").insert(c); if (!error) n += c.length; else console.log("insert err", error.message); }
console.log(`APPLIED fills=${f}/${fills.length} inserts=${n}/${inserts.length}. NOTE: refresh teams.athlete_count after (see README).`);
