"use strict";
/**
 * Full LSU headshot rescrape.
 *
 * Strategy: Visit each athlete's profile page, intercept all image requests,
 * decode the imgproxy base64 URLs to get the original filename, then pick
 * the best match using:
 *   1. Filename contains athlete's name (best)
 *   2. Portrait/square dimensions and unique to this page (good)
 *   3. Any unique-per-page image (fallback)
 *
 * Usage: node --env-file=.env.local scripts/fix-lsu-headshots.js
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Decode an imgproxy base64 URL segment to original source filename
function decodeImgproxyUrl(imgproxyUrl) {
  try {
    const parts = imgproxyUrl.split("/");
    // Base64 is the last part (before extension)
    const last = parts[parts.length - 1].replace(/\.(png|jpg|webp|gif)$/, "");
    // URL-safe base64: - → +, _ → /
    const fixed = last.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "==".slice(0, (4 - (fixed.length % 4)) % 4);
    const decoded = Buffer.from(fixed + padding, "base64").toString("utf8");
    // Extract just the filename from the decoded URL
    return decoded.split("/").pop() || decoded;
  } catch {
    return "";
  }
}

// Parse dimensions from an imgproxy URL (returns { width, height })
function getDimensions(url) {
  const m = url.match(/\/fit\/(\d+)\/(\d+)\//);
  if (m) return { width: parseInt(m[1]), height: parseInt(m[2]) };
  return { width: 0, height: 0 };
}

// Score a candidate URL for a given athlete name
// Higher = better match
function scoreCandidate(url, decodedFilename, athleteName, isUnique) {
  const lower = decodedFilename.toLowerCase();
  const nameParts = athleteName
    .toLowerCase()
    .split(" ")
    .filter((p) => p.length > 2);

  let score = 0;

  // Name match is strongest signal
  const nameMatches = nameParts.filter((p) => lower.includes(p)).length;
  score += nameMatches * 100;

  // Unique to this page
  if (isUnique) score += 20;

  // Portrait-ish dimensions preferred over landscape banners
  const { width, height } = getDimensions(url);
  if (width > 0 && height > 0) {
    const ratio = height / width;
    if (ratio >= 1.0)
      score += 15; // portrait or square
    else if (ratio >= 0.75)
      score += 5; // near-square
    else if (ratio < 0.6) score -= 10; // wide banner
  }

  // Prefer reasonable size (not too tiny or huge)
  if (width >= 200 && width <= 1200) score += 5;

  // Penalize clearly non-headshot filenames
  const bad = [
    /_bg_/,
    /_gn_/,
    /october-/,
    /november-/,
    /december-/,
    /january-/,
    /february-/,
    /march-/,
    /april-/,
    /wb_/,
  ];
  if (bad.some((p) => p.test(lower))) score -= 30;

  return score;
}

// ── Collect intercepted images for a profile page ─────────────────────────────

async function collectPageImages(page, profileUrl) {
  const captured = [];

  const handler = (request) => {
    if (request.resourceType() === "image") {
      const url = request.url();
      if (
        url.includes("lsusports.net/imgproxy") ||
        url.includes("storage.googleapis.com/lsusports")
      ) {
        captured.push(url);
      }
    }
  };

  page.on("request", handler);
  try {
    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(5000);
  } catch (e) {
    // timeout is OK — we just want whatever loaded
  } finally {
    page.off("request", handler);
  }

  return [...new Set(captured)];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("LSU Full Headshot Rescrape (Imgproxy Decode + Name Match)");
  console.log(new Date().toISOString());
  console.log("=".repeat(60));

  const { data: dbTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("name", "LSU")
    .single();

  // Get ALL LSU athletes without valid photos
  const { data: missing } = await supabase
    .from("athletes")
    .select("id, name, profile_url")
    .eq("team_id", dbTeam.id)
    .eq("is_archived", false)
    .is("photo_url", null);

  if (!missing || missing.length === 0) {
    console.log("No missing headshots for LSU!");
    return;
  }

  const withProfile = missing.filter((a) => a.profile_url);
  const withoutProfile = missing.filter((a) => !a.profile_url);

  console.log(`${missing.length} athletes missing photos:`);
  console.log(`  ${withProfile.length} have profile URLs`);
  console.log(`  ${withoutProfile.length} have no profile URL`);
  if (withoutProfile.length > 0) {
    withoutProfile.forEach((a) => console.log(`    - ${a.name}`));
  }
  console.log();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // ── Pass 1: Collect ALL images from ALL profile pages ─────────────────────
  console.log("Pass 1: Collecting images from all profile pages...");
  const athleteImages = new Map(); // athlete.id → string[] (captured URLs)
  const urlFrequency = new Map(); // url → number (how many pages it appears on)

  for (const athlete of withProfile) {
    process.stdout.write(`  ${athlete.name}...`);
    const images = await collectPageImages(page, athlete.profile_url);
    athleteImages.set(athlete.id, images);
    for (const url of images) {
      urlFrequency.set(url, (urlFrequency.get(url) || 0) + 1);
    }
    console.log(` ${images.length} images`);
    await new Promise((r) => setTimeout(r, 500));
  }

  // ── Pass 2: Score and pick best image per athlete ─────────────────────────
  console.log("\nPass 2: Scoring candidates...");
  let updated = 0;
  let failed = 0;

  for (const athlete of withProfile) {
    const images = athleteImages.get(athlete.id) || [];
    if (images.length === 0) {
      console.log(`  ✗ ${athlete.name}: no images captured`);
      failed++;
      continue;
    }

    // Score each candidate
    let best = null;
    let bestScore = -Infinity;

    for (const url of images) {
      const decoded = decodeImgproxyUrl(url);
      const isUnique = (urlFrequency.get(url) || 0) === 1;
      const score = scoreCandidate(url, decoded, athlete.name, isUnique);

      if (score > bestScore) {
        bestScore = score;
        best = { url, decoded, score, isUnique };
      }
    }

    if (!best || bestScore < -20) {
      console.log(
        `  ✗ ${athlete.name}: no suitable image (best score: ${bestScore})`,
      );
      failed++;
      continue;
    }

    console.log(
      `  ${athlete.name}: score=${best.score} unique=${best.isUnique} file=${best.decoded.substring(0, 60)}`,
    );

    const { error } = await supabase
      .from("athletes")
      .update({ photo_url: best.url })
      .eq("id", athlete.id);

    if (!error) {
      updated++;
    } else {
      console.log(`    DB error: ${error.message}`);
      failed++;
    }
  }

  await browser.close();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Updated: ${updated} | Failed: ${failed}`);
  console.log(`Still missing (no profile URL): ${withoutProfile.length}`);
}

main().catch(console.error);
