require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ROSTER_URL =
  "https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/";

const TARGET_ATHLETES = ["Zachary Malek", "Josh McCall", "Tyler Hoard"];

function isValidPhotoUrl(src) {
  if (!src) return false;
  const lower = src.toLowerCase();
  if (lower.startsWith("data:image")) return false;
  return (
    !lower.includes("silhouette") &&
    !lower.includes("placeholder") &&
    !lower.includes("default") &&
    !lower.includes("headshot_generic") &&
    !lower.includes("no-image") &&
    !lower.includes("logo") &&
    !lower.includes("team-logo")
  );
}

function upgradeQuality(src) {
  try {
    const url = new URL(src);
    if (url.searchParams.has("width")) {
      url.searchParams.set("width", "1200");
    }
    if (url.searchParams.has("height")) {
      url.searchParams.set("height", "1200");
    }
    return url.toString();
  } catch {
    return src;
  }
}

async function scrapeProfilePhoto(page, profileUrl, athleteName) {
  try {
    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(3000);

    const photoUrl = await page.evaluate((name) => {
      // Strategy 1: Common SIDEARM profile page selectors
      const selectors = [
        "img.sidearm-roster-player-image",
        "img.roster-bio-photo__image",
        ".s-person-card__photo img",
        ".roster-photo img",
        'img[itemprop="image"]',
        ".s-person-details__media img",
        ".player-image img",
        "picture source",
        "picture img",
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const src =
          el.src ||
          el.getAttribute("data-src") ||
          el.getAttribute("srcset")?.split(" ")[0] ||
          "";
        if (src && !src.startsWith("data:")) return src;
      }

      // Strategy 2: Find by alt text matching athlete name parts
      if (name) {
        const nameParts = name.toLowerCase().split(" ");
        for (const img of document.querySelectorAll("img")) {
          const alt = (img.alt || "").toLowerCase();
          const src = img.src || img.getAttribute("data-src") || "";
          if (
            src &&
            !src.startsWith("data:") &&
            nameParts.some((part) => part.length > 2 && alt.includes(part))
          ) {
            return src;
          }
        }
      }

      // Strategy 3: Look for known athletic photo CDN domains, biggest image
      const athleticDomains = [
        "sidearmdev.com",
        "sidearm.sites",
        "cloudfront.net",
        "imgproxy",
        "gamecocksonline.com",
      ];

      const candidates = [];
      for (const img of document.querySelectorAll("img")) {
        const src = img.src || img.getAttribute("data-src") || "";
        if (!src || src.startsWith("data:")) continue;
        if (athleticDomains.some((d) => src.includes(d))) {
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w >= 80 && h >= 80) {
            candidates.push({ src, area: w * h });
          }
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.area - a.area);
        return candidates[0].src;
      }

      return null;
    }, athleteName);

    return photoUrl;
  } catch (err) {
    console.log(`    Error scraping ${profileUrl}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log(
    "\nFIXING: South Carolina Missing Photos (Malek, McCall, Hoard)\n",
  );

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, logo_url")
    .eq("name", "South Carolina")
    .single();

  if (teamErr || !team) {
    console.error("South Carolina team not found:", teamErr?.message);
    process.exit(1);
  }

  console.log(`Team found: ${team.name} (${team.id})`);

  // Fetch target athletes from DB
  const { data: dbAthletes } = await supabase
    .from("athletes")
    .select("id, name, photo_url, profile_url")
    .eq("team_id", team.id)
    .in("name", TARGET_ATHLETES);

  console.log(`Target athletes in DB: ${dbAthletes.length}`);
  dbAthletes.forEach((a) =>
    console.log(`  - ${a.name}: photo_url=${a.photo_url || "null"}`),
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to roster page
  console.log(`\nLoading roster: ${ROSTER_URL}`);
  await page.goto(ROSTER_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(4000);

  const title = await page.title();
  console.log(`Page title: ${title}`);

  // Collect all roster links
  const rosterLinks = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('a[href*="/roster/"]').forEach((link) => {
      const href = link.href;
      const name = link.textContent?.trim();

      if (!href || seen.has(href)) return;
      if (href.includes("/coaches/") || href.includes("/staff/")) return;
      if (!name || name.length < 2 || name.length > 60) return;
      if (
        name.toLowerCase().includes("full bio") ||
        name.toLowerCase().includes("view bio")
      )
        return;

      seen.add(href);
      results.push({ name, url: href });
    });

    return results;
  });

  console.log(`\nFound ${rosterLinks.length} athlete links on roster page`);

  let updated = 0;
  let notFound = 0;
  let noPhoto = 0;

  for (const target of TARGET_ATHLETES) {
    console.log(`\nProcessing: ${target}`);

    const dbAthlete = dbAthletes.find((a) => a.name === target);
    if (!dbAthlete) {
      console.log("  NOT FOUND in database");
      notFound++;
      continue;
    }

    // Match roster link by name (fuzzy: normalize and compare)
    const targetNorm = target.toLowerCase().replace(/[\s'.-]+/g, "");
    const rosterMatch = rosterLinks.find((r) => {
      const rNorm = r.name.toLowerCase().replace(/[\s'.-]+/g, "");
      return (
        rNorm === targetNorm ||
        rNorm.includes(targetNorm) ||
        targetNorm.includes(rNorm)
      );
    });

    let profileUrl = rosterMatch?.url || null;

    // Fallback: construct URL from name slug
    if (!profileUrl) {
      const slug = target
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z-]/g, "");
      profileUrl = `https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/${slug}/`;
      console.log(`  No roster match — trying slug URL: ${profileUrl}`);
    } else {
      console.log(`  Profile URL: ${profileUrl}`);
    }

    const rawPhotoUrl = await scrapeProfilePhoto(page, profileUrl, target);

    if (!rawPhotoUrl || !isValidPhotoUrl(rawPhotoUrl)) {
      console.log(`  No valid photo found`);
      noPhoto++;
      continue;
    }

    const finalPhoto = upgradeQuality(rawPhotoUrl);
    console.log(`  Photo: ${finalPhoto}`);

    const { error: updateErr } = await supabase
      .from("athletes")
      .update({ photo_url: finalPhoto, profile_url: profileUrl })
      .eq("id", dbAthlete.id);

    if (updateErr) {
      console.log(`  Update error: ${updateErr.message}`);
    } else {
      console.log(`  Updated successfully`);
      updated++;
    }
  }

  await browser.close();

  console.log("\n" + "=".repeat(60));
  console.log(
    `Results: ${updated} updated, ${noPhoto} no photo, ${notFound} not in DB`,
  );
  console.log("=".repeat(60));

  // Verify final state
  console.log("\nVerification:");
  const { data: verifyAthletes } = await supabase
    .from("athletes")
    .select("id, name, photo_url, profile_url")
    .eq("team_id", team.id)
    .in("name", TARGET_ATHLETES);

  verifyAthletes.forEach((a) => {
    const status = a.photo_url ? "HAS PHOTO" : "MISSING";
    console.log(`  [${status}] ${a.name}: ${a.photo_url || "null"}`);
  });
}

main().catch(console.error);
