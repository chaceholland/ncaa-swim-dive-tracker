"use strict";
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TEAMS = [
  { name: "NC State",       school: "NC State",           siteDomain: "gopack.com"             },
  { name: "Pittsburgh",     school: "Pittsburgh Panthers", siteDomain: "pittsburghpanthers.com" },
  { name: "South Carolina", school: "South Carolina",      siteDomain: "gamecocksonline.com"    },
  { name: "LSU",            school: "LSU Tigers",          siteDomain: "lsusports.net"          },
  { name: "Indiana",        school: "Indiana Hoosiers",    siteDomain: "iuhoosiers.com"         },
  { name: "UNLV",           school: "UNLV Rebels",         siteDomain: "unlvrebels.com"         },
];

function upgradePhotoUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has("width")) { u.searchParams.set("width", "1920"); u.searchParams.delete("height"); return u.toString(); }
  } catch {}
  return url;
}

function isValidPhoto(url) {
  if (!url) return false;
  const l = url.toLowerCase();
  return url.startsWith("http") && !l.includes("placeholder") && !l.includes("silhouette") && !l.includes("no-image") && !l.includes("noimage") && !l.includes("logo") && !l.includes("sponsor");
}

async function bingImageSearch(page, athleteName, teamConfig) {
  const query = encodeURIComponent(`${athleteName} ${teamConfig.school} swimming`);
  try {
    await page.goto(`https://www.bing.com/images/search?q=${query}&qft=+filterui:photo-photo`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    return page.evaluate((domain) => {
      const items = document.querySelectorAll("[m]");
      for (const item of items) {
        const m = item.getAttribute("m");
        if (!m) continue;
        try {
          const parsed = JSON.parse(m);
          if (parsed.murl && parsed.murl.includes(domain)) return parsed.murl;
        } catch {}
      }
      for (const img of document.querySelectorAll("img[src]")) {
        if (img.src.includes(domain)) return img.src;
      }
      // Also check sidearmdev CDN (covers all SIDEARM sites)
      const items2 = document.querySelectorAll("[m]");
      for (const item of items2) {
        const m = item.getAttribute("m");
        if (!m) continue;
        try {
          const parsed = JSON.parse(m);
          if (parsed.murl && parsed.murl.includes("sidearmdev.com")) return parsed.murl;
        } catch {}
      }
      return null;
    }, teamConfig.siteDomain);
  } catch { return null; }
}

async function bingSiteSearch(page, athleteName, teamConfig) {
  const query = encodeURIComponent(`${athleteName} ${teamConfig.school} swimming site:${teamConfig.siteDomain}`);
  try {
    await page.goto(`https://www.bing.com/search?q=${query}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);
    const profileUrl = await page.evaluate((domain) => {
      for (const link of document.querySelectorAll(".b_algo a, h2 a")) {
        const href = link.href || "";
        if (href.includes(domain) && (href.includes("roster") || href.includes("swimmer") || href.includes("athlete"))) return href;
      }
      return null;
    }, teamConfig.siteDomain);
    if (!profileUrl) return null;
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    return page.evaluate(() => {
      for (const sel of ["img.roster-bio-photo__image",".s-person-details__bio-image img",".s-person-card__photo img","img.sidearm-roster-player-image",'img[class*="headshot"]','img[class*="bio-photo"]']) {
        const img = document.querySelector(sel);
        if (img && img.src && img.src.startsWith("http") && !img.src.includes("placeholder")) return img.src;
      }
      return null;
    });
  } catch { return null; }
}

async function processTeam(page, teamConfig) {
  console.log(`\n${"=".repeat(55)}\n[${teamConfig.name}]`);
  const { data: dbTeam } = await supabase.from("teams").select("id").eq("name", teamConfig.name).single();
  if (!dbTeam) { console.log("  Not in DB"); return { updated: 0, failed: 0 }; }
  const { data: missing } = await supabase.from("athletes").select("id, name").eq("team_id", dbTeam.id).eq("is_archived", false).is("photo_url", null);
  if (!missing?.length) { console.log("  None missing!"); return { updated: 0, failed: 0 }; }
  console.log(`  ${missing.length} missing`);
  let updated = 0, failed = 0;
  for (const athlete of missing) {
    console.log(`  [${athlete.name}]`);
    let photoUrl = null;
    // Try Bing Images first (fastest)
    photoUrl = await bingImageSearch(page, athlete.name, teamConfig);
    if (!photoUrl || !isValidPhoto(photoUrl)) {
      await new Promise(r => setTimeout(r, 500));
      photoUrl = await bingSiteSearch(page, athlete.name, teamConfig);
    }
    if (photoUrl && isValidPhoto(photoUrl)) {
      const final = upgradePhotoUrl(photoUrl);
      const { error } = await supabase.from("athletes").update({ photo_url: final }).eq("id", athlete.id);
      if (!error) { console.log(`    ✅ ${final.substring(0,70)}...`); updated++; }
      else { console.log(`    ✗ DB error`); failed++; }
    } else { console.log(`    ✗ No photo`); failed++; }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`  → +${updated} updated, ${failed} failed`);
  return { updated, failed };
}

async function main() {
  console.log("Headshot Fixer — Remaining Teams\n" + new Date().toISOString());
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 } })).newPage();
  let total = 0;
  for (const team of TEAMS) {
    const { updated } = await processTeam(page, team);
    total += updated;
    await new Promise(r => setTimeout(r, 2000));
  }
  await browser.close();
  console.log(`\nDONE — Total updated: ${total}`);
}
main().catch(console.error);
