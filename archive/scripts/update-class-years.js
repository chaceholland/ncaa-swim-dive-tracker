require("dotenv").config({ path: ".env.local" });
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TEAMS = [
  {
    name: "Navy",
    url: "https://navysports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "SMU",
    url: "https://smumustangs.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Stanford",
    url: "https://gostanford.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "UNLV",
    url: "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Army",
    url: "https://goarmywestpoint.com/sports/mens-swimming-and-diving/roster",
  },
  { name: "LSU", url: "https://lsusports.net/sports/sd/roster" },
  {
    name: "USC",
    url: "https://usctrojans.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Yale",
    url: "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "North Carolina",
    url: "https://goheels.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Utah",
    url: "https://utahutes.com/sports/swimming-and-diving/roster",
  },
  {
    name: "George Washington",
    url: "https://gwsports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Georgia",
    url: "https://georgiadogs.com/sports/swimming-and-diving/roster",
  },
  { name: "Kentucky", url: "https://ukathletics.com/sports/mswim/roster" },
  {
    name: "Columbia",
    url: "https://gocolumbialions.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Princeton",
    url: "https://goprincetontigers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Michigan",
    url: "https://mgoblue.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Minnesota",
    url: "https://gophersports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Florida",
    url: "https://floridagators.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Tennessee",
    url: "https://utsports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Missouri",
    url: "https://mutigers.com/sports/mens-swimming-and-diving/roster",
  },
];

// ---------------------------------------------------------------------------
// Class year normalizer
// ---------------------------------------------------------------------------
function normalizeClassYear(raw) {
  if (!raw) return null;
  let s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  // Strip "academic year " prefix (USC/Nuxt sites)
  s = s.replace(/^academic year\s+/, "");
  // Strip redshirt prefix: "r-fr." → "fr."
  s = s.replace(/^r-/, "");
  s = s.replace(/^rs-/, "");

  if (s.startsWith("fr") || s === "plebe" || s === "freshman")
    return "freshman";
  if (s.startsWith("so") || s === "youngster" || s === "sophomore")
    return "sophomore";
  if (
    s.startsWith("jr") ||
    s === "junior" ||
    s === "second class" ||
    s === "2/c" ||
    s === "2c"
  )
    return "junior";
  if (
    s.startsWith("sr") ||
    s === "senior" ||
    s === "first class" ||
    s === "1/c" ||
    s === "1c"
  )
    return "senior";
  if (
    s.startsWith("gr") ||
    s === "graduate" ||
    s === "grad" ||
    s === "graduate student" ||
    s === "grad student"
  )
    return "graduate";
  return null;
}

// ---------------------------------------------------------------------------
// Name normalizer — strips punctuation/spaces for fuzzy comparison
// ---------------------------------------------------------------------------
function normName(n) {
  return (n || "").toLowerCase().replace(/[^a-z]/g, "");
}

function lastName(n) {
  const suffixes = new Set(["jr", "sr", "ii", "iii", "iv"]);
  const parts = (n || "").trim().split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].toLowerCase().replace(/[^a-z]/g, "");
    if (!suffixes.has(p) && p.length > 0) return p;
  }
  return normName(parts[parts.length - 1] || "");
}

function findMatch(scrapedName, dbAthletes) {
  const sNorm = normName(scrapedName);
  const exact = dbAthletes.find((a) => normName(a.name) === sNorm);
  if (exact) return exact;

  // Last-name-only match (only if unique in the remaining list)
  const sLast = lastName(scrapedName);
  const lastMatches = dbAthletes.filter((a) => lastName(a.name) === sLast);
  if (lastMatches.length === 1) return lastMatches[0];

  return null;
}

// ---------------------------------------------------------------------------
// Scrape roster page
// Returns array of { name, classYear }
// ---------------------------------------------------------------------------
async function scrapeRoster(page, url, teamName) {
  console.log(`  Loading ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 35000 });
  } catch {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    } catch (err) {
      console.log(`  ERROR loading page: ${err.message}`);
      return [];
    }
  }
  await page.waitForTimeout(8000);

  const results = await page.evaluate(() => {
    const athletes = [];

    // =======================================================================
    // STRATEGY A: SIDEARM v2 table — rows are tbody tr with class odd/even
    // Name in .sidearm-table-player-name, class in td.roster_class
    // Covers: Navy, SMU
    // =======================================================================
    const classCells = document.querySelectorAll("td.roster_class");
    classCells.forEach((classCell) => {
      const row = classCell.closest("tr");
      if (!row) return;
      const nameEl = row.querySelector(
        ".sidearm-table-player-name, .sidearm-roster-player-name, " +
          'td[class*="name"] a, td[class*="name"]',
      );
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      const classYear = classCell.textContent.trim();
      if (name && classYear)
        athletes.push({ name, classYear, source: "v2-table" });
    });

    if (athletes.length > 0) return athletes;

    // =======================================================================
    // STRATEGY B: Nuxt SIDEARM v3 s-person-card
    // Name in .s-person-details__personal-single-line
    // Class year in [data-test-id="s-person-details__bio-stats-person-title"]
    // Covers: USC, Georgia, Michigan, Florida, Army, Tennessee, Missouri,
    //         Minnesota, North Carolina, Columbia, Princeton, Utah, GW, Kentucky, Yale*
    // =======================================================================
    const personCards = document.querySelectorAll(".s-person-card");
    personCards.forEach((card) => {
      const nameEl = card.querySelector(
        ".s-person-details__personal-single-line, " +
          '.s-person-details__personal a, [class*="personal-single-line"] a',
      );
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      if (!name) return;

      // Class year: look for bio-stats title element
      const classEl = card.querySelector(
        '[data-test-id="s-person-details__bio-stats-person-title"], ' +
          ".s-person-details__bio-stats-item:nth-child(2), " +
          ".s-person-details__personal-sport-title",
      );
      if (classEl) {
        const classYear = classEl.textContent.trim();
        if (classYear) {
          athletes.push({ name, classYear, source: "nuxt-card" });
          return;
        }
      }

      // Fallback: look through all bio-stats items for a class year value
      const bioStats = card.querySelectorAll(
        ".s-person-details__bio-stats-item",
      );
      bioStats.forEach((item) => {
        const txt = item.textContent.trim().toLowerCase();
        if (
          txt.includes("freshman") ||
          txt.includes("sophomore") ||
          txt.includes("junior") ||
          txt.includes("senior") ||
          txt.includes("graduate") ||
          /\b(fr|so|jr|sr|gr)\b/.test(txt)
        ) {
          athletes.push({
            name,
            classYear: item.textContent.trim(),
            source: "nuxt-card-fallback",
          });
        }
      });
    });

    if (athletes.length > 0) return athletes;

    // =======================================================================
    // STRATEGY C: Stanford — .roster-card-item
    // Name in .roster-card-item__content (first heading-like element)
    // Class year in .roster-player-card-profile-field__value--basic
    // =======================================================================
    const rosterCardItems = document.querySelectorAll(".roster-card-item");
    rosterCardItems.forEach((item) => {
      // Name: look for heading inside content
      const nameEl = item.querySelector(
        '.roster-card-item__content a, .roster-card-item__content [class*="name"], ' +
          ".roster-card-item__content h3, .roster-card-item__content h2",
      );
      if (!nameEl) {
        // Try any strong link text
        const anyLink = item.querySelector('a[href*="/roster/"]');
        if (!anyLink) return;
        const name = anyLink.textContent.trim();
        if (!name) return;
        const classEl = item.querySelector(
          ".roster-player-card-profile-field__value--basic",
        );
        if (classEl) {
          athletes.push({
            name,
            classYear: classEl.textContent.trim(),
            source: "stanford-card",
          });
        }
        return;
      }
      const name = nameEl.textContent.trim();
      if (!name) return;
      const classEl = item.querySelector(
        ".roster-player-card-profile-field__value--basic",
      );
      if (classEl) {
        athletes.push({
          name,
          classYear: classEl.textContent.trim(),
          source: "stanford-card",
        });
      }
    });

    if (athletes.length > 0) return athletes;

    // =======================================================================
    // STRATEGY D: LSU custom list layout
    // .roster-list_item: name in .roster-list_item_info_name
    // Class year = 2nd <li> in .roster-list_item_info_stats ul
    // =======================================================================
    const listItems = document.querySelectorAll(".roster-list_item");
    listItems.forEach((item) => {
      const nameEl = item.querySelector(
        ".roster-list_item_info_name, .roster-list_item_name",
      );
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      if (!name) return;
      const statLis = item.querySelectorAll(
        ".roster-list_item_info_stats ul li",
      );
      if (statLis.length >= 2) {
        const classYear = statLis[1].textContent.trim();
        if (classYear) athletes.push({ name, classYear, source: "lsu-list" });
      }
    });

    if (athletes.length > 0) return athletes;

    // =======================================================================
    // STRATEGY E: Generic data-label approach (fallback SIDEARM variants)
    // =======================================================================
    const allRows = document.querySelectorAll("tbody tr");
    allRows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      const nameCell = cells.find(
        (td) =>
          (td.dataset.label || "").toLowerCase().includes("name") ||
          (String(td.className) || "").toLowerCase().includes("name"),
      );
      const classCell = cells.find((td) => {
        const lbl = (td.dataset.label || "").toLowerCase();
        return (
          lbl === "class" ||
          lbl === "yr" ||
          lbl === "year" ||
          lbl === "cl." ||
          lbl === "yr."
        );
      });
      if (!nameCell || !classCell) return;
      const nameLink = nameCell.querySelector("a");
      const name = (nameLink || nameCell).textContent.trim();
      const classYear = classCell.textContent.trim();
      if (name && classYear)
        athletes.push({ name, classYear, source: "generic-td" });
    });

    if (athletes.length > 0) return athletes;

    // =======================================================================
    // STRATEGY F: class-year element scan (wide catch-all)
    // =======================================================================
    const classEls = document.querySelectorAll(
      '[class*="class_year"], [class*="classyear"], [class*="class-year"]',
    );
    classEls.forEach((el) => {
      const classYear = el.textContent.trim();
      if (!classYear) return;
      let ancestor = el.parentElement;
      for (let i = 0; i < 6 && ancestor; i++) {
        const nameEl = ancestor.querySelector(
          'h1, h2, h3, h4, [class*="name"], [class*="title"]',
        );
        if (nameEl && nameEl !== el) {
          const name = nameEl.textContent.trim();
          if (name && name.length > 2 && name.length < 60) {
            athletes.push({ name, classYear, source: "class-el-walk" });
            break;
          }
        }
        ancestor = ancestor.parentElement;
      }
    });

    return athletes;
  });

  return results;
}

// ---------------------------------------------------------------------------
// For SIDEARM v1 sites (Yale, UNLV) — scrape individual player profile pages
// The class year is in the rendered profile page HTML
// ---------------------------------------------------------------------------
async function scrapeProfilesForSidearmV1(page, rosterUrl) {
  console.log(`  Loading ${rosterUrl} (SIDEARM v1 profile scrape)`);
  try {
    await page.goto(rosterUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
  } catch (e) {
    console.log(`  ERROR loading roster page: ${e.message}`);
    return [];
  }
  await page.waitForTimeout(5000);

  // Extract player names + rp_id from JSON-LD or DOM
  const players = await page.evaluate(() => {
    const result = [];
    const scripts = Array.from(document.querySelectorAll("script:not([src])"));
    for (const s of scripts) {
      const text = s.textContent.trim();
      if (
        text.includes('"@type":"ListItem"') &&
        text.includes('"@type":"Person"')
      ) {
        try {
          const json = JSON.parse(text);
          const items = json.item || [];
          items.forEach((p) => {
            if (p["@type"] === "Person" && p.name) {
              const urlStr = p.url || "";
              const rp_id = urlStr.match(/rp_id=(\d+)/)?.[1];
              result.push({ name: p.name, url: urlStr, rp_id });
            }
          });
        } catch {
          /* */
        }
      }
    }

    // Also try to get names from links in the DOM (they might have profile URLs)
    if (result.length === 0) {
      document.querySelectorAll('a[href*="/roster/"]').forEach((a) => {
        const href = a.href || "";
        if (
          href.includes("/coaches/") ||
          href.includes("/staff/") ||
          href === rosterUrl
        )
          return;
        const text = a.textContent.trim();
        if (text && text.length > 2 && text.length < 60) {
          result.push({ name: text, url: href });
        }
      });
    }

    return result;
  });

  console.log(`  Found ${players.length} player profile links`);

  // For each player, visit their profile and get class year
  const athletes = [];
  const base = new URL(rosterUrl).origin;

  for (const player of players) {
    // Build profile URL
    let profileUrl = player.url;
    if (profileUrl && profileUrl.includes("rp_id=")) {
      // Old format roster.aspx — follow redirect
      profileUrl = profileUrl; // will redirect automatically
    } else if (!profileUrl || !profileUrl.startsWith("http")) {
      continue;
    }

    try {
      await page.goto(profileUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(2000);

      const classYear = await page.evaluate(() => {
        // SIDEARM v1 profile page: class year is in table rows or specific elements
        const selectors = [
          ".roster-bio-fieldname + .roster-bio-field",
          'td[class*="class"], td.roster_class',
          '[class*="class_year"]',
          ".sidearm-roster-player-class_year",
          // Table approach: find row with "Class" header
          "table tr",
        ];

        // Try direct selectors first
        for (const sel of selectors.slice(0, 4)) {
          const el = document.querySelector(sel);
          if (el) {
            const txt = el.textContent.trim();
            if (txt) return txt;
          }
        }

        // Try table row approach: find a th with "Class" and get corresponding td
        const rows = document.querySelectorAll("table tr");
        for (const row of rows) {
          const cells = row.querySelectorAll("th, td");
          for (let i = 0; i < cells.length; i++) {
            const cellText = cells[i].textContent.trim().toLowerCase();
            if (cellText === "class" || cellText === "year") {
              const nextCell = cells[i + 1];
              if (nextCell) return nextCell.textContent.trim();
            }
          }
        }

        // Scan all text for class year patterns
        const bodyText = document.body.innerText;
        const classMatch = bodyText.match(
          /\bClass\s*:?\s*(Freshman|Sophomore|Junior|Senior|Graduate|Fr\.|So\.|Jr\.|Sr\.|Gr\.)/i,
        );
        if (classMatch) return classMatch[1];

        const yearMatch = bodyText.match(
          /\b(Freshman|Sophomore|Junior|Senior|Graduate)\b/i,
        );
        if (yearMatch) return yearMatch[1];

        return null;
      });

      if (classYear) {
        athletes.push({ name: player.name, classYear });
      }
    } catch (e) {
      // Skip this profile
    }
  }

  return athletes;
}

// ---------------------------------------------------------------------------
// Process one team
// ---------------------------------------------------------------------------
async function processTeam(page, team) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`TEAM: ${team.name}`);
  console.log("=".repeat(70));

  const { data: teamRow, error: teamErr } = await sb
    .from("teams")
    .select("id")
    .ilike("name", team.name)
    .single();

  if (teamErr || !teamRow) {
    console.log(`  ERROR: team "${team.name}" not found in DB`);
    return { updated: 0, unmatched: 0 };
  }

  const teamId = teamRow.id;

  const { data: dbAthletes, error: athErr } = await sb
    .from("athletes")
    .select("id, name")
    .eq("team_id", teamId)
    .is("class_year", null);

  if (athErr) {
    console.log(`  ERROR fetching athletes: ${athErr.message}`);
    return { updated: 0, unmatched: 0 };
  }

  console.log(`  DB athletes missing class_year: ${dbAthletes.length}`);

  if (dbAthletes.length === 0) {
    console.log("  Nothing to do.");
    return { updated: 0, unmatched: 0 };
  }

  // Yale and UNLV use SIDEARM v1 — need individual profile scraping
  const sidearmV1Teams = ["Yale", "UNLV"];
  let scraped;
  if (sidearmV1Teams.includes(team.name)) {
    scraped = await scrapeProfilesForSidearmV1(page, team.url);
  } else {
    scraped = await scrapeRoster(page, team.url, team.name);
  }

  console.log(`  Scraped athletes from page: ${scraped.length}`);

  if (scraped.length === 0) {
    console.log(`  WARNING: No athletes found on roster page — skipping`);
    return { updated: 0, unmatched: 0 };
  }

  // Deduplicate
  const seen = new Set();
  const uniqueScraped = scraped.filter((a) => {
    const key = normName(a.name);
    if (seen.has(key) || !key) return false;
    seen.add(key);
    return true;
  });

  let updated = 0;
  let unmatched = 0;

  for (const scrapedAthlete of uniqueScraped) {
    const normalized = normalizeClassYear(scrapedAthlete.classYear);
    if (!normalized) continue;

    const match = findMatch(scrapedAthlete.name, dbAthletes);
    if (!match) {
      unmatched++;
      continue;
    }

    const { error: upErr } = await sb
      .from("athletes")
      .update({ class_year: normalized })
      .eq("id", match.id)
      .is("class_year", null);

    if (upErr) {
      console.log(`  ERROR updating ${match.name}: ${upErr.message}`);
    } else {
      console.log(
        `  [OK] ${match.name} → "${normalized}"  (raw: "${scrapedAthlete.classYear}")`,
      );
      updated++;
      const idx = dbAthletes.findIndex((a) => a.id === match.id);
      if (idx !== -1) dbAthletes.splice(idx, 1);
    }
  }

  const stillMissing = dbAthletes.length;
  console.log(
    `\n  RESULT: ${updated} updated | ${unmatched} scraped athletes unmatched | ${stillMissing} DB athletes still missing`,
  );

  return { updated, unmatched };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\nNCAA Swim & Dive — Class Year Updater");
  console.log(`Teams to process: ${TEAMS.length}`);
  console.log("Timestamp:", new Date().toISOString());

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(35000);

  let totalUpdated = 0;
  let totalUnmatched = 0;
  const failedTeams = [];

  for (const team of TEAMS) {
    try {
      const result = await processTeam(page, team);
      totalUpdated += result.updated;
      totalUnmatched += result.unmatched;
    } catch (err) {
      console.log(`\n  FATAL ERROR for ${team.name}: ${err.message}`);
      failedTeams.push(team.name);
    }
  }

  await browser.close();

  console.log(`\n${"=".repeat(70)}`);
  console.log("FINAL SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total updated:   ${totalUpdated}`);
  console.log(`Total unmatched: ${totalUnmatched}`);
  if (failedTeams.length > 0) {
    console.log(`Failed teams:    ${failedTeams.join(", ")}`);
  }
  console.log("\nDone. Run this SQL to verify:");
  console.log(
    `  SELECT COUNT(*) FILTER (WHERE class_year IS NULL) as still_missing, COUNT(*) as total FROM athletes;`,
  );
}

main().catch((err) => {
  console.error("Uncaught error:", err);
  process.exit(1);
});
