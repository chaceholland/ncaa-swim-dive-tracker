"use strict";
/**
 * Find headshots for Indiana and UNLV athletes using:
 *   1. SwimCloud search by name
 *   2. Bing web search → find athlete on team site
 *
 * Usage: node --env-file=.env.local scripts/fix-swimcloud-bing-headshots.js
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

const TEAM_CONFIGS = [
  { name: "Indiana", school: "Indiana Hoosiers", siteDomain: "iuhoosiers.com" },
  { name: "UNLV", school: "UNLV Rebels", siteDomain: "unlvrebels.com" },
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
    !lower.includes("default-") &&
    !lower.includes("logo") &&
    !lower.includes("/sponsor")
  );
}

// ── 1. SwimCloud search ───────────────────────────────────────────────────────

async function searchSwimCloud(page, athleteName, schoolName) {
  const query = encodeURIComponent(athleteName);
  try {
    await page.goto(`https://www.swimcloud.com/search/?q=${query}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);

    const swimCloudId = await page.evaluate((school) => {
      // Look for swimmer result cards
      const items = document.querySelectorAll(
        "a[href*='/swimmer/'], .c-search-result, .search-result, li[class*='result']",
      );
      for (const item of items) {
        const text = (item.textContent || "").toLowerCase();
        const href =
          item.getAttribute("href") ||
          item.querySelector("a")?.getAttribute("href") ||
          "";
        // Check if school name appears in the result
        if (
          (text.includes("indiana") ||
            text.includes("hoosier") ||
            text.includes("unlv") ||
            text.includes("rebel") ||
            text.includes(school.toLowerCase().split(" ")[0])) &&
          href.includes("/swimmer/")
        ) {
          const match = href.match(/\/swimmer\/(\d+)/);
          if (match) return match[1];
        }
      }
      // Fallback: grab first swimmer link on the page
      const firstLink = document.querySelector("a[href*='/swimmer/']");
      if (firstLink) {
        const match = firstLink.getAttribute("href").match(/\/swimmer\/(\d+)/);
        if (match) return match[1];
      }
      return null;
    }, schoolName);

    if (!swimCloudId) return null;

    // Visit swimmer profile page
    await page.goto(`https://www.swimcloud.com/swimmer/${swimCloudId}/`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate(() => {
      // SwimCloud avatar image
      const avatarSelectors = [
        ".c-avatar__img",
        ".c-swimmer-avatar img",
        'img[class*="avatar"]',
        ".profile-photo img",
        'img[alt*="profile"]',
        'img[alt*="swimmer"]',
      ];
      for (const sel of avatarSelectors) {
        const img = document.querySelector(sel);
        if (
          img &&
          img.src &&
          img.src.startsWith("http") &&
          !img.src.includes("generic") &&
          !img.src.includes("silhouette") &&
          !img.src.includes("placeholder")
        ) {
          return img.src;
        }
      }
      return null;
    });

    return photoUrl
      ? { source: "swimcloud", url: photoUrl, swimcloudId }
      : null;
  } catch {
    return null;
  }
}

// ── 2. Bing web search → team site profile page ───────────────────────────────

async function searchBingForAthletePhoto(page, athleteName, teamConfig) {
  // Search Bing for athlete profile page on official team site
  const query = encodeURIComponent(
    `${athleteName} ${teamConfig.school} swimming site:${teamConfig.siteDomain}`,
  );
  try {
    await page.goto(`https://www.bing.com/search?q=${query}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(1500);

    // Extract first result URL from official team domain
    const profileUrl = await page.evaluate((domain) => {
      const links = document.querySelectorAll(".b_algo a, h2 a, .b_title a");
      for (const link of links) {
        const href = link.href || "";
        if (
          href.includes(domain) &&
          (href.includes("roster") ||
            href.includes("swimmer") ||
            href.includes("athlete"))
        ) {
          return href;
        }
      }
      return null;
    }, teamConfig.siteDomain);

    if (!profileUrl) return null;

    // Visit the profile page and extract photo
    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      const selectors = [
        "img.roster-bio-photo__image",
        ".s-person-details__bio-image img",
        ".s-person-card__photo img",
        "img.sidearm-roster-player-image",
        'img[class*="headshot"]',
        'img[class*="bio-photo"]',
        ".roster-photo img",
        'img[class*="player-photo"]',
      ];
      for (const sel of selectors) {
        const img = document.querySelector(sel);
        if (
          img &&
          img.src &&
          img.src.startsWith("http") &&
          !img.src.includes("placeholder") &&
          !img.src.includes("silhouette")
        ) {
          return img.src;
        }
      }
      return null;
    });

    return photoUrl ? { source: "bing", url: photoUrl, profileUrl } : null;
  } catch {
    return null;
  }
}

// ── Broader Bing image search as last resort ──────────────────────────────────

async function searchBingImages(page, athleteName, teamConfig) {
  const query = encodeURIComponent(
    `${athleteName} ${teamConfig.school} swimming`,
  );
  try {
    await page.goto(
      `https://www.bing.com/images/search?q=${query}&qft=+filterui:photo-photo`,
      {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      },
    );
    await page.waitForTimeout(2000);

    const imageUrl = await page.evaluate((domain) => {
      // Look for images hosted on the team's official domain
      const imgs = document.querySelectorAll("img[src], a[href*='mediaurl']");
      for (const el of imgs) {
        const src = el.src || "";
        if (src.includes(domain)) return src;
      }
      // Try data attributes
      const items = document.querySelectorAll(
        "[data-src*='" + domain + "'], [m*='" + domain + "']",
      );
      for (const item of items) {
        const m = item.getAttribute("m");
        if (m) {
          try {
            const parsed = JSON.parse(m);
            if (parsed.murl && parsed.murl.includes(domain)) return parsed.murl;
          } catch {}
        }
        const dataSrc = item.getAttribute("data-src");
        if (dataSrc && dataSrc.includes(domain)) return dataSrc;
      }
      return null;
    }, teamConfig.siteDomain);

    return imageUrl ? { source: "bing-images", url: imageUrl } : null;
  } catch {
    return null;
  }
}

// ── Process one athlete ───────────────────────────────────────────────────────

async function findPhoto(page, athlete, teamConfig) {
  // Step 1: SwimCloud
  console.log(`    Trying SwimCloud...`);
  const swimcloudResult = await searchSwimCloud(
    page,
    athlete.name,
    teamConfig.school,
  );
  if (swimcloudResult && isValidPhoto(swimcloudResult.url)) {
    return swimcloudResult;
  }

  await new Promise((r) => setTimeout(r, 800));

  // Step 2: Bing site search
  console.log(`    Trying Bing site search...`);
  const bingResult = await searchBingForAthletePhoto(
    page,
    athlete.name,
    teamConfig,
  );
  if (bingResult && isValidPhoto(bingResult.url)) {
    return bingResult;
  }

  await new Promise((r) => setTimeout(r, 800));

  // Step 3: Bing Image search (official domain only)
  console.log(`    Trying Bing Images...`);
  const bingImgResult = await searchBingImages(page, athlete.name, teamConfig);
  if (bingImgResult && isValidPhoto(bingImgResult.url)) {
    return bingImgResult;
  }

  return null;
}

// ── Process one team ──────────────────────────────────────────────────────────

async function processTeam(page, teamConfig) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${teamConfig.name}]`);

  const { data: dbTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("name", teamConfig.name)
    .single();
  if (!dbTeam) {
    console.log("  Not found in DB");
    return { updated: 0, failed: 0 };
  }

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
  console.log(`  ${missing.length} athletes to find photos for\n`);

  let updated = 0,
    failed = 0;

  for (const athlete of missing) {
    console.log(`  [${athlete.name}]`);
    const result = await findPhoto(page, athlete, teamConfig);

    if (result) {
      const finalUrl = upgradePhotoUrl(result.url);
      const updateData = { photo_url: finalUrl };
      if (result.profileUrl) updateData.profile_url = result.profileUrl;

      const { error } = await supabase
        .from("athletes")
        .update(updateData)
        .eq("id", athlete.id);

      if (!error) {
        console.log(
          `    ✅ Found via ${result.source}: ${finalUrl.substring(0, 70)}...`,
        );
        updated++;
      } else {
        console.log(`    ✗ DB error: ${error.message}`);
        failed++;
      }
    } else {
      console.log(`    ✗ No photo found`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return { updated, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("NCAA Swim Headshot Fixer — SwimCloud + Bing (Indiana & UNLV)");
  console.log(new Date().toISOString());

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  let totalUpdated = 0,
    totalFailed = 0;

  for (const team of TEAM_CONFIGS) {
    const { updated, failed } = await processTeam(page, team);
    totalUpdated += updated;
    totalFailed += failed;
    await new Promise((r) => setTimeout(r, 3000));
  }

  await browser.close();

  console.log(`\n${"=".repeat(60)}`);
  console.log("DONE");
  console.log(`Total updated: ${totalUpdated}`);
  console.log(`Total failed:  ${totalFailed}`);
}

main().catch(console.error);
