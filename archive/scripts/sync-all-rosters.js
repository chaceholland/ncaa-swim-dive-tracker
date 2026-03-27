"use strict";
// sync-all-rosters.js - v3
// Comprehensive roster sync: reads swim_teams.json, scrapes current rosters,
// adds new athletes to DB, archives athletes no longer on roster.

const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// ─── Config ─────────────────────────────────────────────────────────────────

const SWIM_TEAMS_PATH = path.join(process.env.HOME, "swim_teams.json");
const LOG_PATH = path.join(__dirname, "sync-roster-results.json");
const DELAY_MS = 1500; // between team requests
const PAGE_WAIT_MS = 7000; // wait after page load for JS

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// URL overrides — correct URLs where swim_teams.json has wrong ones
const URL_OVERRIDES = {
  "ohio-state": "https://ohiostatebuckeyes.com/sports/mens-swim-dive/roster",
  lsu: "https://lsusports.net/sports/sd/roster",
  alabama: "https://rolltide.com/sports/swimming-and-diving/roster",
  auburn: "https://auburntigers.com/sports/swimming-and-diving/roster",
  georgia: "https://georgiadogs.com/sports/swimming-and-diving/roster",
  "florida-state":
    "https://seminoles.com/sports/mens-swimming-and-diving/roster",
  "georgia-tech": "https://ramblinwreck.com/sports/c-swim/roster/",
  pittsburgh:
    "https://pittsburghpanthers.com/sports/swimming-and-diving/roster",
  utah: "https://utahutes.com/sports/mens-swimming-and-diving/roster",
  "west-virginia":
    "https://wvusports.com/sports/mens-swimming-and-diving/roster",
  "nc-state": "https://gopack.com/sports/swimming-and-diving/roster",
  "texas-am": "https://12thman.com/sports/swimdive/roster",
  duke: "https://goduke.com/sports/swimming-and-diving/roster",
  missouri: "https://mutigers.com/sports/swimming-and-diving/roster",
  tcu: "https://gofrogs.com/sports/swimming-and-diving/roster",
  "virginia-tech": "https://hokiesports.com/sports/swimming-and-diving/roster",
  "north-carolina": "https://goheels.com/sports/swimming-and-diving/roster",
  "notre-dame": "https://fightingirish.com/sports/swim/roster/",
  stanford: "https://gostanford.com/sports/mens-swimming-diving/roster",
  virginia: "https://virginiasports.com/sports/swimming/roster",
  "arizona-state":
    "https://thesundevils.com/sports/mens-swimming-diving/roster",
  louisville: "https://gocards.com/sports/swimming-and-diving/roster",
};

// Combined-gender URLs that need men's section filtering
// (URLs that are NOT men's-specific)
const COMBINED_GENDER_URLS = new Set([
  "rolltide.com/sports/swimming-and-diving",
  "auburntigers.com/sports/swimming-and-diving",
  "georgiadogs.com/sports/swimming-and-diving",
  "lsusports.net/sports/sd",
  "gopack.com/sports/swimming-and-diving",
  "pittsburghpanthers.com/sports/swimming-and-diving",
  "wvusports.com/sports/swimming-and-diving",
  "goduke.com/sports/swimming-and-diving",
  "mutigers.com/sports/swimming-and-diving",
  "gofrogs.com/sports/swimming-and-diving",
  "hokiesports.com/sports/swimming-and-diving",
  "goheels.com/sports/swimming-and-diving",
  "ramblinwreck.com/sports/c-swim",
  "12thman.com/sports/swimdive",
  "gamecocksonline.com/sports/swimming",
  "gocards.com/sports/swimming-and-diving",
  "fightingirish.com/sports/swim",
  "siusalukis.com/sports/mens-swimming-and-diving", // SIU "men's" URL actually shows combined roster
]);

// Teams to skip
// - south-carolina: already done
// - georgia: combined men+women roster page with no gender separation; manually curated
const SKIP_TEAMS = new Set(["south-carolina", "georgia"]);

// Junk names to always exclude
const JUNK_NAMES = new Set([
  "skip ad",
  "full bio",
  "name",
  "full name",
  "roster",
  "schedule",
  "news",
  "close",
  "menu",
  "search",
  "home",
  "back",
  "pronunciation guide",
]);

// Junk name suffixes to strip or skip
const JUNK_SUFFIXES = [" inflcr", " nil store", " nil"];

function hasJunkSuffix(name) {
  const lower = name.toLowerCase();
  return JUNK_SUFFIXES.some((s) => lower.endsWith(s));
}

function normalizeName(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function classifyType(pos) {
  if (!pos) return null;
  const p = pos.toLowerCase();
  if (p.includes("div")) return "diver";
  if (
    p.includes("swim") ||
    p.includes("free") ||
    p.includes("back") ||
    p.includes("breast") ||
    p.includes("fly") ||
    p.includes("butterfly") ||
    p.includes("medley") ||
    p.includes("im") ||
    p.includes("sprint") ||
    p.includes("distance") ||
    p.includes("stroke") ||
    p.includes("breaststroke")
  ) {
    return "swimmer";
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isCombinedGenderUrl(url) {
  for (const pattern of COMBINED_GENDER_URLS) {
    if (url.toLowerCase().includes(pattern)) return true;
  }
  return false;
}

// ─── Scraping logic ──────────────────────────────────────────────────────────

async function scrapeRoster(page, url, teamId) {
  const isCombined = isCombinedGenderUrl(url);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await sleep(PAGE_WAIT_MS);

    const result = await page.evaluate((combined) => {
      const results = [];

      // ── Method 1: SIDEARM s-table with gender section headers ──
      const sTables = document.querySelectorAll(".s-table");
      if (sTables.length > 0) {
        let found = 0;
        sTables.forEach((table) => {
          const headerRow = table.querySelector(
            ".s-table-header__row--heading",
          );
          const gender = headerRow
            ? headerRow.textContent.trim().toLowerCase()
            : "men";
          // Skip non-athlete sections
          if (
            gender.includes("coach") ||
            gender.includes("staff") ||
            gender.includes("support")
          )
            return;
          // For combined rosters only include men's section
          if (combined) {
            const isMen = gender.includes("men") && !gender.includes("women");
            if (!isMen) return;
          }
          const rows = table.querySelectorAll("tbody tr");
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length === 0) return;
            // Find the name cell: first non-empty, non-numeric cell
            let name = "";
            let posCell = null;
            for (let i = 0; i < Math.min(cells.length, 3); i++) {
              const text = cells[i].textContent.trim();
              if (
                text &&
                text.length >= 2 &&
                !/^\d+$/.test(text) &&
                text !== "Name" &&
                text !== "Full Name"
              ) {
                name = text;
                posCell = cells[i + 1] || null;
                break;
              }
            }
            if (!name || name.length < 2) return;
            results.push({
              name,
              pos: posCell ? posCell.textContent.trim() : "",
            });
            found++;
          });
        });
        if (found > 0) return { method: "sidearm-table", athletes: results };
      }

      // ── Method 2: SIDEARM s-person-card ──
      const cards = document.querySelectorAll(".s-person-card");
      if (cards.length > 0) {
        cards.forEach((card) => {
          const nameEl = card.querySelector(
            'h3, [class*="personal-single-line"]',
          );
          const name = nameEl ? nameEl.textContent.trim() : "";
          if (!name || name.length < 2) return;
          let pos = "";
          const bioStats = card.querySelectorAll('[class*="bio-stats-item"]');
          bioStats.forEach((stat) => {
            const text = stat.textContent.trim();
            if (text.startsWith("Position "))
              pos = text.replace("Position ", "");
          });
          results.push({ name, pos });
        });
        if (results.length > 0)
          return { method: "sidearm-card", athletes: results };
      }

      // ── Method 3: Old SIDEARM markup ──
      const oldPlayers = document.querySelectorAll(".sidearm-roster-player");
      if (oldPlayers.length > 0) {
        oldPlayers.forEach((player) => {
          const nameEl = player.querySelector(".sidearm-roster-player-name");
          const posEl = player.querySelector(".sidearm-roster-player-position");
          const name = nameEl ? nameEl.textContent.trim() : "";
          if (!name) return;
          results.push({ name, pos: posEl ? posEl.textContent.trim() : "" });
        });
        if (results.length > 0)
          return { method: "old-sidearm", athletes: results };
      }

      // ── Method 4: .roster-players__group (Virginia Tech, Auburn, Virginia, Stanford, Arizona State) ──
      // Uses gender section headers h2 + .roster-players-cards or ul list
      const rosterGroups = document.querySelectorAll(".roster-players__group");
      if (rosterGroups.length > 0) {
        for (const group of rosterGroups) {
          const titleEl = group.querySelector(
            'h2, h3, [class*="content-box-title"]',
          );
          const title = titleEl ? titleEl.textContent.trim() : "";
          // For combined, find Men's group; for men's-only, take any group
          if (combined && !title.includes("Men")) continue;

          // Cards container (Stanford uses this)
          const cardsDiv = group.querySelector(".roster-players-cards");
          if (cardsDiv) {
            Array.from(cardsDiv.children).forEach((card) => {
              const link = card.querySelector('a[href*="/roster/"]');
              const name = link ? link.textContent.trim() : "";
              const img = card.querySelector("img");
              const imgName = img ? img.getAttribute("alt") || "" : "";
              const finalName = name || imgName;
              if (finalName && finalName.length > 2) {
                results.push({ name: finalName, pos: "" });
              }
            });
          } else {
            // List items (Virginia Tech, Auburn, Virginia)
            const items = group.querySelectorAll("li");
            items.forEach((item) => {
              // img alt attribute (Virginia Tech, Auburn)
              const img = item.querySelector("img");
              let name = img ? img.getAttribute("alt") || "" : "";

              // sr-only elements (Virginia)
              if (!name) {
                const srElems = item.querySelectorAll(".sr-only");
                srElems.forEach((el) => {
                  const t = el.textContent.trim();
                  if (
                    t &&
                    t.length > 2 &&
                    !t.toLowerCase().includes("instagram") &&
                    !t.toLowerCase().includes("twitter") &&
                    !t.toLowerCase().includes("facebook") &&
                    !t.toLowerCase().includes("tiktok") &&
                    !t.toLowerCase().includes("linkedin")
                  ) {
                    if (!name) name = t;
                  }
                });
              }

              // Position
              const posEl = item.querySelector(
                '[class*="position"], [class*="event"]',
              );
              const pos = posEl ? posEl.textContent.trim() : "";
              if (name && name.length > 2) results.push({ name, pos });
            });
          }

          if (results.length > 0) break; // got men's section
        }
        if (results.length > 0)
          return { method: "roster-players-group", athletes: results };
      }

      // ── Method 5: LSU WP theme (.roster-list_item with itemprop) ──
      const lsuItems = document.querySelectorAll(".roster-list_item");
      if (lsuItems.length > 0) {
        const menItems = [];
        const rosterLists = document.querySelectorAll(".roster-list");

        if (combined && rosterLists.length > 0) {
          for (const list of rosterLists) {
            const titleEl = list.querySelector(".section-title");
            if (
              titleEl &&
              titleEl.textContent.trim().toLowerCase().includes("men")
            ) {
              list.querySelectorAll(".roster-list_item").forEach((item) => {
                const nameEl = item.querySelector('[itemprop="name"]');
                const name = nameEl ? nameEl.getAttribute("content") || "" : "";
                const posEl = item.querySelector(
                  ".roster-list_item_info_position",
                );
                const pos = posEl ? posEl.textContent.trim() : "";
                if (name) menItems.push({ name, pos });
              });
              break;
            }
          }
        } else {
          lsuItems.forEach((item) => {
            const nameEl = item.querySelector('[itemprop="name"]');
            const name = nameEl ? nameEl.getAttribute("content") || "" : "";
            const posEl = item.querySelector(".roster-list_item_info_position");
            const pos = posEl ? posEl.textContent.trim() : "";
            if (name) menItems.push({ name, pos });
          });
        }
        if (menItems.length > 0)
          return { method: "lsu-wp", athletes: menItems };
      }

      // ── Method 6: Kentucky WP theme (.roster-item with itemprop) ──
      const wpItems = document.querySelectorAll(".roster-item, .roster__item");
      if (wpItems.length > 0) {
        wpItems.forEach((item) => {
          const nameEl = item.querySelector('[itemprop="name"]');
          const name = nameEl
            ? nameEl.getAttribute("content") || nameEl.textContent.trim()
            : "";
          if (!name || name.length < 2) return;
          let pos = "";
          item.querySelectorAll("p, span, div").forEach((el) => {
            const t = el.textContent.trim();
            if (
              t &&
              t !== name &&
              !t.includes("Full Bio") &&
              !t.startsWith("http") &&
              t.length < 50 &&
              t.length > 1 &&
              !t.match(/^\d/) &&
              !t.match(/freshman|sophomore|junior|senior|graduate/i)
            ) {
              if (!pos) pos = t.replace(/ -$/, "").trim();
            }
          });
          results.push({ name, pos });
        });
        if (results.length > 0)
          return { method: "wp-roster-item", athletes: results };
      }

      // ── Method 7: Notre Dame (.featured__list containing .player cards) ──
      // Structure: .title "Men's Roster" h2, then .featured__list with .player cards
      const featuredLists = document.querySelectorAll(".featured__list");
      if (featuredLists.length > 0) {
        // Find the men's featured list: preceded by a .title containing "Men"
        let mensList = null;
        featuredLists.forEach((list) => {
          if (list.classList.contains("staff")) return;
          const prevSibling = list.previousElementSibling;
          if (prevSibling && prevSibling.classList.contains("title")) {
            const titleText = prevSibling.textContent.trim().toLowerCase();
            if (titleText.includes("men") && !titleText.includes("women")) {
              mensList = list;
            }
          }
        });
        // If no men's list found (men's-only site), use first non-staff list
        if (!mensList && !combined) {
          mensList = Array.from(featuredLists).find(
            (l) => !l.classList.contains("staff"),
          );
        }
        if (mensList) {
          mensList.querySelectorAll(".player").forEach((p) => {
            const nameEl = p.querySelector("h3");
            const name = nameEl ? nameEl.textContent.trim() : "";
            if (name && name.length > 2) results.push({ name, pos: "" });
          });
        }
        if (results.length > 0)
          return { method: "notre-dame", athletes: results };
      }
      // Fallback: direct .player query (men's-only pages)
      const ndPlayers = document.querySelectorAll(".player");
      if (ndPlayers.length > 0) {
        ndPlayers.forEach((p) => {
          const nameEl = p.querySelector("h3");
          const name = nameEl ? nameEl.textContent.trim() : "";
          if (name && name.length > 2) results.push({ name, pos: "" });
        });
        if (results.length > 0)
          return { method: "notre-dame", athletes: results };
      }

      // ── Method 8: Georgia Tech (.roster__list_item) ──
      const gtItems = document.querySelectorAll(".roster__list_item");
      if (gtItems.length > 0) {
        gtItems.forEach((item) => {
          const nameEl = item.querySelector(
            '.earit_player, a[href*="roster"], [class*="name"]',
          );
          const name = nameEl ? nameEl.textContent.trim() : "";
          if (name && name.length > 2) results.push({ name, pos: "" });
        });
        if (results.length > 0)
          return { method: "georgia-tech", athletes: results };
      }

      // ── Method 9: Generic table with section-header rows ──
      // Handles tables that embed "Men's Roster" / "Women's Roster" as section rows
      const tableRows = document.querySelectorAll("table tbody tr, table tr");
      if (tableRows.length > 0) {
        let inMensSection = false;
        let inWomensSection = false;
        let hasSections = false;

        tableRows.forEach((row) => {
          const cells = row.querySelectorAll("td, th");
          if (cells.length === 1) {
            // Possible section header row
            const headerText = cells[0].textContent.trim().toLowerCase();
            if (headerText.includes("men") && !headerText.includes("women")) {
              inMensSection = true;
              inWomensSection = false;
              hasSections = true;
              return;
            }
            if (headerText.includes("women")) {
              inWomensSection = true;
              inMensSection = false;
              hasSections = true;
              return;
            }
            if (headerText.includes("coach") || headerText.includes("staff")) {
              inMensSection = false;
              inWomensSection = false;
              return;
            }
          }

          // Skip header rows
          if (cells.length === 0) return;
          const firstCellText = cells[0].textContent.trim();
          if (firstCellText === "Name" || firstCellText === "#") return;

          // Only include row if in men's section (or no sections found)
          if (hasSections && !inMensSection) return;

          // Find name cell
          let name = "";
          let pos = "";
          for (let i = 0; i < Math.min(cells.length, 3); i++) {
            const text = cells[i].textContent.trim();
            if (
              text &&
              text.length >= 2 &&
              !/^\d+$/.test(text) &&
              text !== "Name" &&
              text !== "Full Name"
            ) {
              name = text;
              pos = cells[i + 1] ? cells[i + 1].textContent.trim() : "";
              break;
            }
          }
          if (name && name.length > 2) {
            results.push({ name, pos });
          }
        });
        if (results.length > 0)
          return { method: "table-fallback", athletes: results };
      }

      return { method: "none", athletes: [] };
    }, isCombined);

    return result;
  } catch (err) {
    return { method: "error", athletes: [], error: err.message };
  }
}

// ─── Kentucky special scrape ─────────────────────────────────────────────────

async function scrapeKentuckyWP(page) {
  await page.goto("https://ukathletics.com/sports/mswim/roster", {
    waitUntil: "domcontentloaded",
    timeout: 35000,
  });
  await sleep(9000); // Kentucky loads very slowly

  const athletes = await page.evaluate(() => {
    const results = [];
    const items = document.querySelectorAll(
      ".roster-item, .roster__item, .roster-item--default",
    );
    items.forEach((item) => {
      const nameEl = item.querySelector('[itemprop="name"]');
      const name = nameEl ? nameEl.getAttribute("content") || "" : "";
      if (!name || name.length < 2) return;
      let pos = "";
      item
        .querySelectorAll(
          "p, span, .roster-item__position, .roster-item__event",
        )
        .forEach((el) => {
          const t = el.textContent.trim();
          if (
            t &&
            t !== name &&
            !t.includes("Full Bio") &&
            t.length < 60 &&
            t.length > 1 &&
            !t.match(/freshman|sophomore|junior|senior/i)
          ) {
            if (!pos) pos = t.replace(/ -$/, "").trim();
          }
        });
      results.push({ name, pos });
    });
    return results;
  });

  return { method: "kentucky-wp", athletes };
}

// ─── Clean athlete list ───────────────────────────────────────────────────────

const STAFF_KEYWORDS = [
  "coach",
  "trainer",
  "director",
  "coordinator",
  "manager",
  "staff",
  "assistant",
  "head coach",
  "associate",
  "strength",
  "conditioning",
];

function cleanAthletes(raw) {
  const seen = new Set();
  const cleaned = [];

  for (const a of raw) {
    const name = (a.name || "").trim();
    if (!name || name.length < 3) continue;

    const nameLower = name.toLowerCase();
    const posLower = (a.pos || "").toLowerCase();

    // Skip junk entries
    if (JUNK_NAMES.has(nameLower)) continue;

    // Skip entries with junk suffixes (INFLCR, NIL Store, etc.)
    if (hasJunkSuffix(name)) continue;

    // Skip staff/coaches by position
    if (STAFF_KEYWORDS.some((kw) => posLower.includes(kw))) continue;

    // Skip obvious coach names in position (e.g., "Head Coach", "Diving Coach")
    if (
      posLower.includes("coach") ||
      posLower.includes("director") ||
      posLower.includes("trainer")
    )
      continue;

    const norm = normalizeName(name);
    if (seen.has(norm)) continue;
    seen.add(norm);

    cleaned.push({ name, athleteType: classifyType(a.pos) });
  }

  return cleaned;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log("NCAA Swim/Dive Roster Sync v2 - " + new Date().toISOString());
  console.log("=".repeat(70));

  const swimTeams = JSON.parse(fs.readFileSync(SWIM_TEAMS_PATH, "utf8"));
  console.log("\nLoaded", swimTeams.length, "teams from swim_teams.json");

  const { data: dbTeams, error: teamErr } = await supabase
    .from("teams")
    .select("id, name");
  if (teamErr)
    throw new Error("Failed to load teams from DB: " + teamErr.message);

  const dbTeamByName = new Map(dbTeams.map((t) => [t.name.toLowerCase(), t]));

  const results = [];
  let totalAdded = 0;
  let totalArchived = 0;
  let totalUnchanged = 0;
  const failedTeams = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  for (const team of swimTeams) {
    const teamId = team.id;
    const teamName = team.name;

    if (SKIP_TEAMS.has(teamId)) {
      console.log(`\n[${teamName}] SKIPPED (already done)`);
      continue;
    }

    const dbTeam = dbTeamByName.get(teamName.toLowerCase());
    if (!dbTeam) {
      console.log(`\n[${teamName}] SKIP - team not found in DB`);
      failedTeams.push({ team: teamName, reason: "not in DB" });
      continue;
    }

    const url = URL_OVERRIDES[teamId] || team.url;
    console.log(`\n${"─".repeat(60)}`);
    console.log(`[${teamName}] ${url}`);

    let scrapeResult;
    try {
      if (teamId === "kentucky") {
        scrapeResult = await scrapeKentuckyWP(page);
      } else {
        scrapeResult = await scrapeRoster(page, url, teamId);
      }
    } catch (err) {
      console.log(`  ERROR during scrape: ${err.message}`);
      failedTeams.push({ team: teamName, reason: err.message });
      results.push({
        team: teamName,
        added: 0,
        archived: 0,
        unchanged: 0,
        error: err.message,
      });
      await sleep(DELAY_MS);
      continue;
    }

    const { method, athletes: rawAthletes, error: scrapeError } = scrapeResult;

    if (scrapeError || method === "error") {
      console.log(`  ERROR: ${scrapeError || "unknown"}`);
      failedTeams.push({
        team: teamName,
        reason: scrapeError || "scrape failed",
      });
      results.push({
        team: teamName,
        added: 0,
        archived: 0,
        unchanged: 0,
        error: scrapeError,
      });
      await sleep(DELAY_MS);
      continue;
    }

    if (!rawAthletes || rawAthletes.length === 0) {
      console.log(`  WARNING: 0 athletes scraped [${method}]. Skipping.`);
      failedTeams.push({ team: teamName, reason: "0 athletes scraped" });
      results.push({
        team: teamName,
        added: 0,
        archived: 0,
        unchanged: 0,
        error: "0 athletes scraped",
        method,
      });
      await sleep(DELAY_MS);
      continue;
    }

    const cleanedAthletes = cleanAthletes(rawAthletes);
    console.log(
      `  Scraped ${rawAthletes.length} → cleaned ${cleanedAthletes.length} [${method}]`,
    );

    // Load DB athletes for this team
    const { data: dbAthletes, error: dbErr } = await supabase
      .from("athletes")
      .select("id, name, is_archived")
      .eq("team_id", dbTeam.id);

    if (dbErr) {
      console.log(`  DB ERROR: ${dbErr.message}`);
      failedTeams.push({ team: teamName, reason: dbErr.message });
      results.push({
        team: teamName,
        added: 0,
        archived: 0,
        unchanged: 0,
        error: dbErr.message,
      });
      await sleep(DELAY_MS);
      continue;
    }

    const activeDbAthletes = dbAthletes.filter((a) => !a.is_archived);
    const archivedDbAthletes = dbAthletes.filter((a) => a.is_archived);

    const activeByNorm = new Map(
      activeDbAthletes.map((a) => [normalizeName(a.name), a]),
    );
    const archivedByNorm = new Map(
      archivedDbAthletes.map((a) => [normalizeName(a.name), a]),
    );
    const scrapedNorms = new Set(
      cleanedAthletes.map((a) => normalizeName(a.name)),
    );

    let added = 0,
      archived = 0,
      reactivated = 0;

    // Add new / reactivate previously archived
    for (const athlete of cleanedAthletes) {
      const norm = normalizeName(athlete.name);
      if (activeByNorm.has(norm)) continue; // already active, nothing to do

      if (archivedByNorm.has(norm)) {
        const rec = archivedByNorm.get(norm);
        const { error: e } = await supabase
          .from("athletes")
          .update({
            is_archived: false,
            athlete_type: athlete.athleteType || rec.athlete_type,
          })
          .eq("id", rec.id);
        if (!e) {
          reactivated++;
          console.log(`  + REACTIVATED: ${athlete.name}`);
        } else {
          console.log(`  WARN reactivate ${athlete.name}: ${e.message}`);
        }
        continue;
      }

      // Insert new
      const { error: e } = await supabase.from("athletes").insert({
        name: athlete.name,
        team_id: dbTeam.id,
        athlete_type: athlete.athleteType,
        is_archived: false,
      });
      if (!e) {
        added++;
        console.log(`  + ADDED: ${athlete.name}`);
      } else {
        console.log(`  WARN insert ${athlete.name}: ${e.message}`);
      }
    }

    // Archive athletes no longer on roster
    for (const dbAthlete of activeDbAthletes) {
      const norm = normalizeName(dbAthlete.name);
      if (scrapedNorms.has(norm)) continue;
      const { error: e } = await supabase
        .from("athletes")
        .update({ is_archived: true })
        .eq("id", dbAthlete.id);
      if (!e) {
        archived++;
        console.log(`  - ARCHIVED: ${dbAthlete.name}`);
      } else {
        console.log(`  WARN archive ${dbAthlete.name}: ${e.message}`);
      }
    }

    const unchanged = activeDbAthletes.filter((a) =>
      scrapedNorms.has(normalizeName(a.name)),
    ).length;

    console.log(
      `  Result: +${added} added, +${reactivated} reactivated, -${archived} archived, =${unchanged} unchanged`,
    );

    results.push({
      team: teamName,
      method,
      scraped: cleanedAthletes.length,
      added,
      reactivated,
      archived,
      unchanged,
    });
    totalAdded += added + reactivated;
    totalArchived += archived;
    totalUnchanged += unchanged;

    await sleep(DELAY_MS);
  }

  await browser.close();

  // ── Summary ──
  console.log("\n" + "=".repeat(70));
  console.log("SYNC COMPLETE");
  console.log("=".repeat(70));
  console.log(`Teams processed: ${results.length}`);
  console.log(`Total added/reactivated: ${totalAdded}`);
  console.log(`Total archived: ${totalArchived}`);
  console.log(`Total unchanged: ${totalUnchanged}`);

  if (failedTeams.length > 0) {
    console.log(`\nFailed teams (${failedTeams.length}):`);
    failedTeams.forEach((f) => console.log(`  - ${f.team}: ${f.reason}`));
  }

  console.log("\nPer-team summary:");
  results.forEach((r) => {
    if (r.error) {
      console.log(`  ${r.team}: ERROR - ${r.error}`);
    } else {
      console.log(
        `  ${r.team}: +${r.added || 0} added, +${r.reactivated || 0} reactivated, -${r.archived || 0} archived, =${r.unchanged || 0} unchanged [${r.method}]`,
      );
    }
  });

  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      totalAdded,
      totalArchived,
      totalUnchanged,
      failedCount: failedTeams.length,
    },
    results,
    failedTeams,
  };
  fs.writeFileSync(LOG_PATH, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${LOG_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
