require("dotenv").config({ path: ".env.local" });
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ---------------------------------------------------------------------------
// Normalizer — DB only allows freshman/sophomore/junior/senior
// ---------------------------------------------------------------------------
function normalizeClassYear(raw) {
  if (!raw) return null;
  let s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  s = s.replace(/^academic year\s+/, "");
  s = s.replace(/^r-/, "").replace(/^rs-/, "");
  if (s.startsWith("fr") || s === "plebe") return "freshman";
  if (s.startsWith("so") || s === "youngster") return "sophomore";
  if (s.startsWith("jr") || s === "second class" || s === "2/c" || s === "2c")
    return "junior";
  if (s.startsWith("sr") || s === "first class" || s === "1/c" || s === "1c")
    return "senior";
  // graduate/grad not allowed in DB — skip
  return null;
}

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
  const sLast = lastName(scrapedName);
  const lastMatches = dbAthletes.filter((a) => lastName(a.name) === sLast);
  if (lastMatches.length === 1) return lastMatches[0];
  return null;
}

async function goTo(page, url, wait = 12000) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (e) {
    console.log(`  Load error: ${e.message.substring(0, 60)}`);
  }
  await page.waitForTimeout(wait);
}

// ---------------------------------------------------------------------------
// Scrapers for specific sites
// ---------------------------------------------------------------------------

// Kentucky — tbody tr, class year is column index 4 (Class header)
async function scrapeKentucky(page) {
  await goTo(page, "https://ukathletics.com/sports/mswim/roster", 10000);
  return page.evaluate(() => {
    const athletes = [];
    const rows = document.querySelectorAll("tbody tr.odd, tbody tr.even");
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 5) return;
      const name = cells[0].textContent.trim();
      const classYear = cells[4].textContent.trim();
      if (name && classYear && name.length > 2) {
        athletes.push({ name, classYear });
      }
    });
    return athletes;
  });
}

// Missouri — same pattern as Kentucky (SIDEARM v2 table without td classes)
// Try the correct URL
async function scrapeMissouri(page) {
  await goTo(
    page,
    "https://mutigers.com/sports/swimming-and-diving/roster",
    15000,
  );
  return page.evaluate(() => {
    const athletes = [];

    // Try s-person-card (Nuxt)
    const cards = document.querySelectorAll(".s-person-card");
    cards.forEach((card) => {
      const nameEl = card.querySelector(
        ".s-person-details__personal-single-line, [class*='personal-single']",
      );
      const bioEl = card.querySelector(
        '[data-test-id="s-person-details__bio-stats-person-title"]',
      );
      if (nameEl && bioEl) {
        const name = nameEl.textContent.trim();
        const classYear = bioEl.textContent.trim();
        if (name && classYear) athletes.push({ name, classYear });
      }
    });

    if (athletes.length > 0) return athletes;

    // Try td.roster_class
    const classCells = document.querySelectorAll("td.roster_class");
    classCells.forEach((classCell) => {
      const row = classCell.closest("tr");
      if (!row) return;
      const nameEl = row.querySelector(
        ".sidearm-table-player-name, td:first-child",
      );
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      const classYear = classCell.textContent.trim();
      if (name && classYear) athletes.push({ name, classYear });
    });

    if (athletes.length > 0) return athletes;

    // Try tbody tr positional (column index 4 = Class)
    const rows = document.querySelectorAll(
      "tbody tr.odd, tbody tr.even, tbody tr",
    );
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 5) return;
      const name = cells[0].textContent.trim();
      const classYear = cells[4].textContent.trim();
      const validClass = [
        "Freshman",
        "Sophomore",
        "Junior",
        "Senior",
        "Graduate",
        "Fr.",
        "So.",
        "Jr.",
        "Sr.",
        "Gr.",
        "FR",
        "SO",
        "JR",
        "SR",
        "GR",
      ];
      if (name && validClass.includes(classYear.trim())) {
        athletes.push({ name, classYear });
      }
    });

    return athletes;
  });
}

// UNC — Nuxt s-person-card, needs long wait
async function scrapeUNC(page) {
  await goTo(
    page,
    "https://goheels.com/sports/swimming-and-diving/roster",
    20000,
  );
  return page.evaluate(() => {
    const athletes = [];
    const cards = document.querySelectorAll(".s-person-card");
    cards.forEach((card) => {
      const nameEl = card.querySelector(
        ".s-person-details__personal-single-line, [class*='personal-single']",
      );
      const bioEl = card.querySelector(
        '[data-test-id="s-person-details__bio-stats-person-title"]',
      );
      if (nameEl && bioEl) {
        const name = nameEl.textContent.trim();
        const classYear = bioEl.textContent.trim();
        if (name && classYear) athletes.push({ name, classYear });
      }
    });
    // Also try td.roster_class
    if (athletes.length === 0) {
      document.querySelectorAll("td.roster_class").forEach((classCell) => {
        const row = classCell.closest("tr");
        if (!row) return;
        const nameEl = row.querySelector(
          ".sidearm-table-player-name, td:first-child",
        );
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        const classYear = classCell.textContent.trim();
        if (name && classYear) athletes.push({ name, classYear });
      });
    }
    return athletes;
  });
}

// Utah — same approach as UNC
async function scrapeUtah(page) {
  await goTo(
    page,
    "https://utahutes.com/sports/mens-swimming-and-diving/roster",
    20000,
  );
  return page.evaluate(() => {
    const athletes = [];
    const cards = document.querySelectorAll(".s-person-card");
    cards.forEach((card) => {
      const nameEl = card.querySelector(
        ".s-person-details__personal-single-line, [class*='personal-single']",
      );
      const bioEl = card.querySelector(
        '[data-test-id="s-person-details__bio-stats-person-title"]',
      );
      if (nameEl && bioEl) {
        const name = nameEl.textContent.trim();
        const classYear = bioEl.textContent.trim();
        if (name && classYear) athletes.push({ name, classYear });
      }
    });
    if (athletes.length === 0) {
      document.querySelectorAll("td.roster_class").forEach((classCell) => {
        const row = classCell.closest("tr");
        if (!row) return;
        const nameEl = row.querySelector(
          ".sidearm-table-player-name, td:first-child",
        );
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        const classYear = classCell.textContent.trim();
        if (name && classYear) athletes.push({ name, classYear });
      });
    }
    return athletes;
  });
}

// UNLV — profile scrape but only match against DB athletes (filter to men)
async function scrapeUNLV(page, dbAthletes) {
  await goTo(
    page,
    "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
    8000,
  );

  // Get all player names + profile URLs from JSON-LD
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
          // json.item may be an object with numeric keys or an array
          const itemsRaw = json.item || [];
          const items = Array.isArray(itemsRaw)
            ? itemsRaw
            : Object.values(itemsRaw);
          items.forEach((p) => {
            if (p && p["@type"] === "Person" && p.name) {
              result.push({
                name: p.name,
                url: p.url || "",
                gender: p.gender || "",
              });
            }
          });
        } catch {
          /**/
        }
      }
    }
    return result;
  });

  console.log(`  Found ${players.length} players in JSON-LD`);

  // Filter to only men (gender M or unspecified) who match DB athletes
  const dbNames = new Set(dbAthletes.map((a) => normName(a.name)));
  const dbLastNames = new Set(dbAthletes.map((a) => lastName(a.name)));

  // If gender info available, pre-filter to males; otherwise fall back to name matching only
  const genderFiltered = players.filter(
    (p) => !p.gender || p.gender.toUpperCase() !== "F",
  );
  console.log(`  Gender-filtered (non-female): ${genderFiltered.length}`);

  const menPlayers = genderFiltered.filter((p) => {
    const pNorm = normName(p.name);
    const pLast = lastName(p.name);
    return dbNames.has(pNorm) || dbLastNames.has(pLast);
  });

  console.log(`  Filtered to ${menPlayers.length} men's players`);

  const athletes = [];
  for (const player of menPlayers) {
    if (!player.url) continue;
    try {
      await page.goto(player.url, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(2000);
      const classYear = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const m = bodyText.match(
          /\b(Freshman|Sophomore|Junior|Senior|Graduate)\b/i,
        );
        return m ? m[1] : null;
      });
      if (classYear) athletes.push({ name: player.name, classYear });
    } catch {
      /**/
    }
  }
  return athletes;
}

// ---------------------------------------------------------------------------
// Update DB for one team
// ---------------------------------------------------------------------------
async function updateTeam(teamName, scraped, dbAthletes) {
  const seen = new Set();
  const uniqueScraped = scraped.filter((a) => {
    const key = normName(a.name);
    if (seen.has(key) || !key) return false;
    seen.add(key);
    return true;
  });

  let updated = 0;
  let skippedGrad = 0;

  for (const scrapedAthlete of uniqueScraped) {
    const normalized = normalizeClassYear(scrapedAthlete.classYear);
    if (!normalized) {
      // Graduate student or unknown — skip
      if (scrapedAthlete.classYear && /gr/i.test(scrapedAthlete.classYear))
        skippedGrad++;
      continue;
    }

    const match = findMatch(scrapedAthlete.name, dbAthletes);
    if (!match) continue;

    const { error: upErr } = await sb
      .from("athletes")
      .update({ class_year: normalized })
      .eq("id", match.id)
      .is("class_year", null);

    if (upErr) {
      console.log(
        `  ERROR updating ${match.name}: ${upErr.message.substring(0, 60)}`,
      );
    } else {
      console.log(
        `  [OK] ${match.name} → "${normalized}"  (raw: "${scrapedAthlete.classYear}")`,
      );
      updated++;
      const idx = dbAthletes.findIndex((a) => a.id === match.id);
      if (idx !== -1) dbAthletes.splice(idx, 1);
    }
  }

  if (skippedGrad > 0)
    console.log(`  Skipped ${skippedGrad} graduate students (not in DB enum)`);
  return updated;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\nNCAA Swim & Dive — Class Year Updater (Pass 2)");
  console.log("Timestamp:", new Date().toISOString());

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const TEAM_SCRAPERS = [
    { name: "Kentucky", fn: scrapeKentucky },
    { name: "Missouri", fn: scrapeMissouri },
    { name: "North Carolina", fn: scrapeUNC },
    { name: "Utah", fn: scrapeUtah },
  ];

  let totalUpdated = 0;

  // Handle standard teams
  for (const { name, fn } of TEAM_SCRAPERS) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`TEAM: ${name}`);
    console.log("=".repeat(70));

    const { data: teamRow } = await sb
      .from("teams")
      .select("id")
      .ilike("name", name)
      .single();
    if (!teamRow) {
      console.log(`  ERROR: team not found`);
      continue;
    }

    const { data: dbAthletes } = await sb
      .from("athletes")
      .select("id, name")
      .eq("team_id", teamRow.id)
      .is("class_year", null);
    console.log(`  DB athletes missing class_year: ${dbAthletes.length}`);
    if (dbAthletes.length === 0) {
      console.log("  Nothing to do.");
      continue;
    }

    const scraped = await fn(page);
    console.log(`  Scraped athletes: ${scraped.length}`);

    if (scraped.length === 0) {
      console.log("  WARNING: No athletes found");
      continue;
    }
    const upd = await updateTeam(name, scraped, dbAthletes);
    totalUpdated += upd;
    console.log(
      `\n  RESULT: ${upd} updated | ${dbAthletes.length} still missing`,
    );
  }

  // Handle UNLV separately (needs DB athletes for filtering)
  console.log(`\n${"=".repeat(70)}`);
  console.log("TEAM: UNLV");
  console.log("=".repeat(70));
  {
    const { data: teamRow } = await sb
      .from("teams")
      .select("id")
      .ilike("name", "UNLV")
      .single();
    if (teamRow) {
      const { data: dbAthletes } = await sb
        .from("athletes")
        .select("id, name")
        .eq("team_id", teamRow.id)
        .is("class_year", null);
      console.log(`  DB athletes missing class_year: ${dbAthletes.length}`);
      if (dbAthletes.length > 0) {
        const scraped = await scrapeUNLV(page, dbAthletes);
        console.log(`  Scraped athletes: ${scraped.length}`);
        const upd = await updateTeam("UNLV", scraped, dbAthletes);
        totalUpdated += upd;
        console.log(
          `\n  RESULT: ${upd} updated | ${dbAthletes.length} still missing`,
        );
      }
    }
  }

  await browser.close();

  console.log(`\n${"=".repeat(70)}`);
  console.log(`TOTAL UPDATED IN PASS 2: ${totalUpdated}`);
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("Uncaught error:", err);
  process.exit(1);
});
