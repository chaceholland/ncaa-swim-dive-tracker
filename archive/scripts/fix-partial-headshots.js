"use strict";
/**
 * Scrape headshots for athletes missing photos from the 9 partially-covered teams.
 * For each team: loads the official roster page, finds profile URLs for missing athletes,
 * visits each profile page, and extracts the photo.
 *
 * Usage: node --env-file=.env.local scripts/fix-partial-headshots.js
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TEAMS = [
  {
    name: "LSU",
    url: "https://lsusports.net/sports/sd/roster",
    combined: true,
  },
  {
    name: "Ohio State",
    url: "https://ohiostatebuckeyes.com/sports/mens-swim-dive/roster",
    combined: false,
  },
  {
    name: "Florida State",
    url: "https://seminoles.com/sports/mens-swimming-and-diving/roster",
    combined: false,
  },
  {
    name: "NC State",
    url: "https://gopack.com/sports/swimming-and-diving/roster",
    combined: true,
  },
  {
    name: "Pittsburgh",
    url: "https://pittsburghpanthers.com/sports/swimming-and-diving/roster",
    combined: true,
  },
  {
    name: "Notre Dame",
    url: "https://fightingirish.com/sports/swim/roster/",
    combined: true,
  },
  {
    name: "South Carolina",
    url: "https://gamecocksonline.com/sports/swimming/roster",
    combined: true,
  },
  {
    name: "Wisconsin",
    url: "https://uwbadgers.com/sports/mens-swimming-and-diving/roster",
    combined: false,
  },
  {
    name: "Virginia",
    url: "https://virginiasports.com/sports/swimming/roster",
    combined: false,
  },
];

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
    url.startsWith("http") &&
    !lower.includes("placeholder") &&
    !lower.includes("silhouette") &&
    !lower.includes("headshot_generic") &&
    !lower.includes("no-image") &&
    !lower.includes("noimage") &&
    !lower.includes("default-")
  );
}

// ── Extract profile links from roster page ────────────────────────────────────

async function extractRosterLinks(page, url, combined) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
  await page.waitForTimeout(5000);

  return page.evaluate((isCombined) => {
    const athletes = [];

    // Helper: is this a men's section?
    function isMensSection(el) {
      let cur = el;
      for (let i = 0; i < 8; i++) {
        if (!cur) break;
        const text = (cur.textContent || "").trim().toLowerCase();
        const hdr =
          cur.querySelector &&
          cur.querySelector("h2, h3, [class*='header'], [class*='title']");
        if (hdr) {
          const t = hdr.textContent.trim().toLowerCase();
          if (t.includes("women")) return false;
          if (t.includes("men") && !t.includes("women")) return true;
        }
        cur = cur.parentElement;
      }
      return true; // default: include
    }

    // Method 1: .s-person-card
    const cards = document.querySelectorAll(".s-person-card");
    if (cards.length > 0) {
      cards.forEach((card) => {
        if (isCombined && !isMensSection(card)) return;
        const nameEl = card.querySelector(
          "h3, [class*='personal-single-line'], [class*='name']",
        );
        const linkEl = card.querySelector("a[href]");
        const imgEl = card.querySelector("img");
        const name = nameEl ? nameEl.textContent.trim() : "";
        const profileUrl = linkEl ? linkEl.href : null;
        const photo = imgEl ? imgEl.src || imgEl.dataset.src : null;
        if (name && name.length > 2) athletes.push({ name, profileUrl, photo });
      });
      if (athletes.length > 0) return athletes;
    }

    // Method 2: .sidearm-roster-player (old SIDEARM)
    const players = document.querySelectorAll(".sidearm-roster-player");
    if (players.length > 0) {
      players.forEach((p) => {
        if (isCombined && !isMensSection(p)) return;
        const nameEl = p.querySelector(
          ".sidearm-roster-player-name a, .sidearm-roster-player-name",
        );
        const imgEl = p.querySelector("img");
        const linkEl = p.querySelector(".sidearm-roster-player-name a");
        const name = nameEl ? nameEl.textContent.trim() : "";
        const photo = imgEl ? imgEl.src || imgEl.dataset.src : null;
        const profileUrl = linkEl ? linkEl.href : null;
        if (name && name.length > 2) athletes.push({ name, profileUrl, photo });
      });
      if (athletes.length > 0) return athletes;
    }

    // Method 3: .s-table rows
    const rows = document.querySelectorAll(".s-table tbody tr");
    if (rows.length > 0) {
      let inMens = !isCombined;
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        // Check for gender section header rows
        if (cells.length === 1) {
          const t = cells[0].textContent.trim().toLowerCase();
          if (t.includes("men") && !t.includes("women")) inMens = true;
          else if (t.includes("women")) inMens = false;
          return;
        }
        if (isCombined && !inMens) return;
        const imgEl = row.querySelector("img");
        const photo = imgEl ? imgEl.src || imgEl.dataset.src : null;
        const linkEl = row.querySelector(
          "a[href*='roster'], a[href*='swimmer'], a[href*='athlete']",
        );
        const nameEl = row.querySelector("td a, [class*='name']");
        const name = nameEl ? nameEl.textContent.trim() : "";
        const profileUrl = linkEl ? linkEl.href : null;
        if (name && name.length > 2) athletes.push({ name, profileUrl, photo });
      });
      if (athletes.length > 0) return athletes;
    }

    // Method 4: .roster-players__group li items (Virginia, Virginia Tech, etc.)
    const groups = document.querySelectorAll(".roster-players__group");
    if (groups.length > 0) {
      for (const group of groups) {
        const titleEl = group.querySelector("h2, h3");
        const title = titleEl ? titleEl.textContent.trim().toLowerCase() : "";
        if (isCombined && title.includes("women")) continue;

        group.querySelectorAll("li").forEach((item) => {
          const img = item.querySelector("img");
          let name = img ? img.getAttribute("alt") || "" : "";
          const srElems = item.querySelectorAll(".sr-only");
          srElems.forEach((el) => {
            const t = el.textContent.trim();
            if (
              t &&
              t.length > 2 &&
              !t.toLowerCase().includes("instagram") &&
              !t.toLowerCase().includes("twitter") &&
              !t.toLowerCase().includes("facebook")
            ) {
              if (!name) name = t;
            }
          });
          const linkEl = item.querySelector("a[href]");
          const photo = img ? img.src || img.dataset.src : null;
          const profileUrl = linkEl ? linkEl.href : null;
          if (name && name.length > 2)
            athletes.push({ name, profileUrl, photo });
        });
        if (athletes.length > 0) break;
      }
      if (athletes.length > 0) return athletes;
    }

    // Method 5: Notre Dame .player cards
    const ndPlayers = document.querySelectorAll(".player");
    if (ndPlayers.length > 0) {
      ndPlayers.forEach((p) => {
        if (isCombined && !isMensSection(p)) return;
        const nameEl = p.querySelector("h3");
        const imgEl = p.querySelector("img");
        const linkEl = p.querySelector("a[href]");
        const name = nameEl ? nameEl.textContent.trim() : "";
        const photo = imgEl ? imgEl.src || imgEl.dataset.src : null;
        const profileUrl = linkEl ? linkEl.href : null;
        if (name && name.length > 2) athletes.push({ name, profileUrl, photo });
      });
      if (athletes.length > 0) return athletes;
    }

    // Method 6: LSU .roster-list_item
    const lsuItems = document.querySelectorAll(".roster-list_item");
    if (lsuItems.length > 0) {
      let inMens = !isCombined;
      const lists = document.querySelectorAll(".roster-list");
      if (isCombined && lists.length > 0) {
        for (const list of lists) {
          const titleEl = list.querySelector(".section-title");
          if (
            titleEl &&
            titleEl.textContent.trim().toLowerCase().includes("men") &&
            !titleEl.textContent.trim().toLowerCase().includes("women")
          ) {
            list.querySelectorAll(".roster-list_item").forEach((item) => {
              const nameEl = item.querySelector('[itemprop="name"]');
              const name = nameEl ? nameEl.getAttribute("content") || "" : "";
              const imgEl = item.querySelector("img");
              const photo = imgEl ? imgEl.src : null;
              const linkEl = item.querySelector("a[href*='roster']");
              const profileUrl = linkEl ? linkEl.href : null;
              if (name) athletes.push({ name, profileUrl, photo });
            });
            break;
          }
        }
      } else {
        lsuItems.forEach((item) => {
          const nameEl = item.querySelector('[itemprop="name"]');
          const name = nameEl ? nameEl.getAttribute("content") || "" : "";
          const imgEl = item.querySelector("img");
          const photo = imgEl ? imgEl.src : null;
          const linkEl = item.querySelector("a[href*='roster']");
          const profileUrl = linkEl ? linkEl.href : null;
          if (name) athletes.push({ name, profileUrl, photo });
        });
      }
      if (athletes.length > 0) return athletes;
    }

    return athletes;
  }, combined);
}

// ── Scrape photo from individual profile page ─────────────────────────────────

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
        ".s-person-details img",
        ".roster-bio img",
        'img[class*="player-photo"]',
        'img[class*="roster"]',
      ];
      for (const sel of selectors) {
        const img = document.querySelector(sel);
        if (img && img.src && img.src.startsWith("http")) return img.src;
      }
      // Fallback: largest portrait-ish img from athletic domain
      let best = null,
        bestArea = 0;
      for (const img of document.querySelectorAll("img")) {
        const src = img.src || "";
        if (!src.startsWith("http")) continue;
        if (
          src.includes("logo") ||
          src.includes("sponsor") ||
          src.includes("placeholder")
        )
          continue;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        const ratio = w > 0 && h > 0 ? w / h : 0;
        if (ratio > 0.4 && ratio < 0.9 && w * h > bestArea) {
          best = src;
          bestArea = w * h;
        }
      }
      return best;
    });
  } catch {
    return null;
  }
}

// ── Process one team ──────────────────────────────────────────────────────────

async function processTeam(page, teamConfig) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[${teamConfig.name}] ${teamConfig.url}`);

  // Get DB team
  const { data: dbTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("name", teamConfig.name)
    .single();
  if (!dbTeam) {
    console.log("  Not found in DB");
    return { updated: 0, failed: 0 };
  }

  // Load athletes missing photos
  const { data: missing } = await supabase
    .from("athletes")
    .select("id, name, profile_url")
    .eq("team_id", dbTeam.id)
    .eq("is_archived", false)
    .is("photo_url", null);

  if (!missing || missing.length === 0) {
    console.log("  No missing headshots!");
    return { updated: 0, failed: 0 };
  }
  console.log(`  ${missing.length} missing headshots`);

  const missingByNorm = new Map(missing.map((a) => [normalizeName(a.name), a]));

  // Scrape roster page to get profile URLs and inline photos
  console.log("  Scraping roster page...");
  let rosterAthletes = [];
  try {
    rosterAthletes = await extractRosterLinks(
      page,
      teamConfig.url,
      teamConfig.combined,
    );
    console.log(`  Found ${rosterAthletes.length} athletes on roster page`);
  } catch (err) {
    console.log(`  Roster scrape error: ${err.message}`);
  }

  let updated = 0,
    failed = 0;
  const profileQueue = [];

  // Match scraped athletes to missing DB athletes
  for (const scraped of rosterAthletes) {
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
        console.log(`  ✅ ${dbAthlete.name} (inline)`);
        missingByNorm.delete(norm);
        updated++;
      }
    } else if (scraped.profileUrl) {
      profileQueue.push({ dbAthlete, profileUrl: scraped.profileUrl });
      missingByNorm.delete(norm);
    }
  }

  // For athletes matched from roster but without inline photo, visit their profile pages
  if (profileQueue.length > 0) {
    console.log(`  Visiting ${profileQueue.length} profile pages...`);
    for (const { dbAthlete, profileUrl } of profileQueue) {
      const photo = await scrapeProfilePhoto(page, profileUrl);
      const finalPhoto = photo ? upgradePhotoUrl(photo) : null;
      if (finalPhoto && isValidPhoto(finalPhoto)) {
        const { error } = await supabase
          .from("athletes")
          .update({ photo_url: finalPhoto, profile_url: profileUrl })
          .eq("id", dbAthlete.id);
        if (!error) {
          console.log(`  ✅ ${dbAthlete.name}`);
          updated++;
        } else {
          console.log(`  ⚠️  ${dbAthlete.name} — DB error`);
          failed++;
        }
      } else {
        await supabase
          .from("athletes")
          .update({ profile_url: profileUrl })
          .eq("id", dbAthlete.id);
        console.log(`  ⚠️  ${dbAthlete.name} — no photo on profile`);
        failed++;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  // Athletes with existing profile_url but no roster match — try their saved profile URL
  for (const [, dbAthlete] of missingByNorm) {
    if (dbAthlete.profile_url) {
      const photo = await scrapeProfilePhoto(page, dbAthlete.profile_url);
      const finalPhoto = photo ? upgradePhotoUrl(photo) : null;
      if (finalPhoto && isValidPhoto(finalPhoto)) {
        await supabase
          .from("athletes")
          .update({ photo_url: finalPhoto })
          .eq("id", dbAthlete.id);
        console.log(`  ✅ ${dbAthlete.name} (saved profile)`);
        updated++;
        missingByNorm.delete(normalizeName(dbAthlete.name));
      }
    }
  }

  // Final unmatched
  for (const [, a] of missingByNorm) {
    console.log(`  ✗ ${a.name} — unmatched`);
    failed++;
  }

  console.log(`  → +${updated} updated, ${failed} failed`);
  return { updated, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("NCAA Swim Headshot Fixer — Partial Coverage Teams");
  console.log(new Date().toISOString());

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  let totalUpdated = 0,
    totalFailed = 0;

  for (const team of TEAMS) {
    const { updated, failed } = await processTeam(page, team);
    totalUpdated += updated;
    totalFailed += failed;
    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();

  console.log(`\n${"=".repeat(60)}`);
  console.log("DONE");
  console.log(`Total updated: ${totalUpdated}`);
  console.log(`Total failed:  ${totalFailed}`);
}

main().catch(console.error);
