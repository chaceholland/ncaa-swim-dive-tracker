"use strict";
/**
 * Scrape headshots for Indiana and UNLV from their SIDEARM roster pages.
 * Tries SIDEARM JSON API first, falls back to Playwright HTML scraping.
 * Usage: node --env-file=.env.local scripts/fix-indiana-unlv-headshots.js
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TEAMS = [
  {
    name: "Indiana",
    rosterUrl: "https://iuhoosiers.com/sports/mens-swimming-and-diving/roster",
    // SIDEARM API: sport_id varies — try common ones
    apiBaseUrl: "https://iuhoosiers.com",
    sportPath: "mens-swimming-and-diving",
  },
  {
    name: "UNLV",
    rosterUrl: "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
    apiBaseUrl: "https://unlvrebels.com",
    sportPath: "mens-swimming-and-diving",
  },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function normalizeName(n) {
  return (n || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function upgradePhotoUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has("width")) {
      u.searchParams.set("width", "1920");
      u.searchParams.delete("height");
      return u.toString();
    }
  } catch {}
  return url;
}

function isValidPhoto(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    !lower.includes("placeholder") &&
    !lower.includes("silhouette") &&
    !lower.includes("headshot_generic") &&
    !lower.includes("no-image") &&
    !lower.includes("noimage") &&
    !lower.includes("default-") &&
    url.startsWith("http")
  );
}

// ── Try SIDEARM JSON API ──────────────────────────────────────────────────────

async function trySidearmApi(apiBaseUrl, sportPath) {
  // Discover sport_id via /api/v2/sports
  let sportId = null;
  try {
    const resp = await fetch(`${apiBaseUrl}/api/v2/sports`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (resp.ok) {
      const data = await resp.json();
      const sports = data.sports || data;
      if (Array.isArray(sports)) {
        for (const s of sports) {
          if (
            (s.sport_id_url || "").includes(sportPath) ||
            (s.name || "").toLowerCase().includes("swim")
          ) {
            sportId = s.id || s.sport_id;
            break;
          }
        }
      }
    }
  } catch {}

  if (!sportId) return null;

  // Fetch players
  try {
    const resp = await fetch(
      `${apiBaseUrl}/api/v2/players?sport_id=${sportId}`,
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
      },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const players = data.players || data;
    if (!Array.isArray(players) || players.length === 0) return null;

    const result = [];
    for (const p of players) {
      const name =
        [p.first_name, p.last_name].filter(Boolean).join(" ") ||
        p.full_name ||
        p.name;
      const photo =
        p.headshot_url ||
        p.photo_url ||
        p.image_url ||
        (p.headshot && p.headshot.url) ||
        null;
      if (name) result.push({ name, photo });
    }
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

// ── Playwright HTML scraping ──────────────────────────────────────────────────

async function scrapeRosterWithPlaywright(page, rosterUrl) {
  await page.goto(rosterUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
  await page.waitForTimeout(5000);

  return page.evaluate(() => {
    const results = [];

    // Method 1: .s-person-card (modern SIDEARM)
    const cards = document.querySelectorAll(".s-person-card");
    if (cards.length > 0) {
      cards.forEach((card) => {
        const nameEl = card.querySelector(
          'h3, [class*="personal-single-line"], [class*="person-details__name"]',
        );
        const name = nameEl ? nameEl.textContent.trim() : "";

        const imgEl = card.querySelector(
          '.s-person-card__photo img, img[class*="headshot"], img[class*="photo"]',
        );
        const photo = imgEl ? imgEl.src || imgEl.dataset.src : null;

        const linkEl = card.querySelector("a[href]");
        const profileUrl = linkEl ? linkEl.href : null;

        if (name) results.push({ name, photo, profileUrl });
      });
      if (results.length > 0)
        return { method: "s-person-card", athletes: results };
    }

    // Method 2: .sidearm-roster-player (old SIDEARM)
    const players = document.querySelectorAll(".sidearm-roster-player");
    if (players.length > 0) {
      players.forEach((p) => {
        const nameEl = p.querySelector(
          ".sidearm-roster-player-name a, .sidearm-roster-player-name",
        );
        const imgEl = p.querySelector(
          ".sidearm-roster-player-image img, img.roster-player-image, img.sidearm-roster-player-image",
        );
        const linkEl = p.querySelector(".sidearm-roster-player-name a");
        const name = nameEl ? nameEl.textContent.trim() : "";
        const photo = imgEl ? imgEl.src || imgEl.dataset.src : null;
        const profileUrl = linkEl ? linkEl.href : null;
        if (name) results.push({ name, photo, profileUrl });
      });
      if (results.length > 0)
        return { method: "old-sidearm", athletes: results };
    }

    // Method 3: s-table rows
    const rows = document.querySelectorAll(".s-table tbody tr");
    if (rows.length > 0) {
      rows.forEach((row) => {
        const imgEl = row.querySelector("img");
        const photo = imgEl ? imgEl.src || imgEl.dataset.src : null;
        const linkEl = row.querySelector("a[href*='roster']");
        const nameEl = row.querySelector(
          "td:first-child a, td:nth-child(2) a, [class*='name']",
        );
        const name = nameEl ? nameEl.textContent.trim() : "";
        const profileUrl = linkEl ? linkEl.href : null;
        if (name) results.push({ name, photo, profileUrl });
      });
      if (results.length > 0) return { method: "s-table", athletes: results };
    }

    return { method: "none", athletes: [] };
  });
}

// ── Scrape individual profile page for photo ─────────────────────────────────

async function scrapeProfilePhoto(page, profileUrl) {
  try {
    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);

    return page.evaluate(() => {
      const selectors = [
        "img.roster-bio-photo__image",
        ".s-person-details__bio-image img",
        ".s-person-card__photo img",
        "img.sidearm-roster-player-image",
        'img[class*="headshot"]',
        'img[class*="bio-photo"]',
        ".roster-photo img",
      ];
      for (const sel of selectors) {
        const img = document.querySelector(sel);
        if (img && img.src && img.src.startsWith("http")) return img.src;
      }
      return null;
    });
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processTeam(page, team) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${team.name}]`);
  console.log("=".repeat(60));

  // Load DB athletes missing photos
  const { data: dbTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("name", team.name)
    .single();

  if (!dbTeam) {
    console.log("  Team not found in DB");
    return { updated: 0, failed: 0 };
  }

  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, name, photo_url, profile_url")
    .eq("team_id", dbTeam.id)
    .eq("is_archived", false)
    .is("photo_url", null);

  console.log(`  ${athletes.length} athletes missing headshots`);
  if (athletes.length === 0) return { updated: 0, failed: 0 };

  const missingByNorm = new Map(
    athletes.map((a) => [normalizeName(a.name), a]),
  );

  // Try SIDEARM API
  let rosterData = null;
  console.log("  Trying SIDEARM API...");
  rosterData = await trySidearmApi(team.apiBaseUrl, team.sportPath);
  if (rosterData) {
    console.log(`  API returned ${rosterData.length} athletes`);
  } else {
    console.log("  API failed, falling back to Playwright...");
    const result = await scrapeRosterWithPlaywright(page, team.rosterUrl);
    rosterData = result.athletes || [];
    console.log(
      `  Playwright scraped ${rosterData.length} athletes [${result.method}]`,
    );
  }

  let updated = 0;
  let failed = 0;
  const profileQueue = []; // athletes still needing profile page visit

  // Match by name and apply photos from roster page
  for (const scraped of rosterData) {
    const norm = normalizeName(scraped.name);
    const dbAthlete = missingByNorm.get(norm);
    if (!dbAthlete) continue;

    const photo = scraped.photo ? upgradePhotoUrl(scraped.photo) : null;

    if (photo && isValidPhoto(photo)) {
      const { error } = await supabase
        .from("athletes")
        .update({
          photo_url: photo,
          profile_url: scraped.profileUrl || dbAthlete.profile_url,
        })
        .eq("id", dbAthlete.id);
      if (!error) {
        console.log(`  ✅ ${dbAthlete.name} → ${photo.substring(0, 70)}...`);
        missingByNorm.delete(norm);
        updated++;
      }
    } else if (scraped.profileUrl) {
      // Photo not in roster card — queue for profile page visit
      profileQueue.push({ dbAthlete, profileUrl: scraped.profileUrl });
      missingByNorm.delete(norm);
    }
  }

  // Visit individual profile pages for remaining athletes
  if (profileQueue.length > 0) {
    console.log(
      `\n  Visiting ${profileQueue.length} profile pages for photos...`,
    );
    for (const { dbAthlete, profileUrl } of profileQueue) {
      const photo = await scrapeProfilePhoto(page, profileUrl);
      const finalPhoto = photo ? upgradePhotoUrl(photo) : null;

      if (finalPhoto && isValidPhoto(finalPhoto)) {
        const { error } = await supabase
          .from("athletes")
          .update({ photo_url: finalPhoto, profile_url: profileUrl })
          .eq("id", dbAthlete.id);
        if (!error) {
          console.log(
            `  ✅ ${dbAthlete.name} (profile) → ${finalPhoto.substring(0, 70)}...`,
          );
          updated++;
        }
      } else {
        // Still save the profile_url even without photo
        await supabase
          .from("athletes")
          .update({ profile_url: profileUrl })
          .eq("id", dbAthlete.id);
        console.log(`  ⚠️  ${dbAthlete.name} — no photo on profile page`);
        failed++;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Report remaining unmatched
  if (missingByNorm.size > 0) {
    console.log(`\n  Unmatched (${missingByNorm.size}):`);
    for (const [, a] of missingByNorm) {
      console.log(`    - ${a.name}`);
      failed++;
    }
  }

  return { updated, failed };
}

async function main() {
  console.log("NCAA Swim Headshot Fixer — Indiana & UNLV");
  console.log(new Date().toISOString());

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  let totalUpdated = 0;
  let totalFailed = 0;

  for (const team of TEAMS) {
    const { updated, failed } = await processTeam(page, team);
    totalUpdated += updated;
    totalFailed += failed;
    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();

  console.log(`\n${"=".repeat(60)}`);
  console.log("DONE");
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Failed/unmatched: ${totalFailed}`);
}

main().catch(console.error);
