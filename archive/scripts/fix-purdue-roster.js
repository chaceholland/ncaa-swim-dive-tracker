require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function decodeImgproxyUrl(imgproxyUrl) {
  // Purdue uses pattern: .../q:90/{base64}.jpg (same as Penn State)
  const match = imgproxyUrl.match(/\/([^\/]+)\.(jpg|png)$/);

  if (!match) {
    return null;
  }

  try {
    const base64Url = match[1];
    const originalUrl = Buffer.from(base64Url, 'base64').toString('utf-8');

    // Verify it's a valid storage.googleapis.com URL
    if (originalUrl.includes('storage.googleapis.com')) {
      return originalUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function scrapeAthleteHeadshot(page, athleteUrl, athleteName) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const photoUrl = await page.evaluate((name) => {
      // PURDUE-SPECIFIC: Look for lazy-loaded headshot image
      // Purdue uses img[alt*="Headshot"] with url attribute (not src)
      const headshotImg = document.querySelector('img[alt*="Headshot"]');

      if (headshotImg) {
        // Get the url attribute (lazy-loaded images store actual URL here)
        const url = headshotImg.getAttribute('url');
        if (url && url.includes('imgproxy')) {
          return url; // Return imgproxy URL for decoding
        }
      }

      return null;
    }, athleteName);

    // Decode imgproxy URL if found
    if (photoUrl && photoUrl.includes('imgproxy')) {
      const decodedUrl = decodeImgproxyUrl(photoUrl);
      if (decodedUrl) {
        return decodedUrl;
      }
    }

    return photoUrl;
  } catch (error) {
    console.error(`    Error scraping ${athleteName}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING PURDUE ROSTER');
  console.log('Scraping and decoding imgproxy headshots for all Purdue athletes...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get Purdue team
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Purdue')
    .single();

  if (!team) {
    console.log('❌ Purdue team not found');
    await browser.close();
    return;
  }

  // Get all Purdue athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, profile_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} Purdue athletes in database\n`);

  let updated = 0;
  let withHeadshot = 0;
  let withLogo = 0;

  for (const athlete of athletes) {
    console.log(`  Processing: ${athlete.name}`);

    if (!athlete.profile_url) {
      console.log(`    ⚠️  No profile URL - skipping`);
      continue;
    }

    const photoUrl = await scrapeAthleteHeadshot(page, athlete.profile_url, athlete.name);

    await supabase
      .from('athletes')
      .update({
        photo_url: photoUrl || team.logo_url,
      })
      .eq('id', athlete.id);

    if (photoUrl) {
      console.log(`    ✅ Updated with headshot`);
      withHeadshot++;
    } else {
      console.log(`    ⚠️  Updated with team logo (no headshot found)`);
      withLogo++;
    }
    updated++;

    await page.waitForTimeout(500);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ PURDUE ROSTER FIX COMPLETE');
  console.log('='.repeat(70));
  console.log(`Updated: ${updated}/${athletes.length} athletes`);
  console.log(`  ${withHeadshot} with headshots`);
  console.log(`  ${withLogo} with team logo`);
  console.log('');
}

main();
