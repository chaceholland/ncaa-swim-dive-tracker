require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function decodeImgproxyUrl(imgproxyUrl) {
  try {
    // Extract base64 portion from LSU imgproxy URL
    // Format: /imgproxy/.../fit/1980/1080/ce/0/{base64}.png
    const match = imgproxyUrl.match(/\/ce\/0\/([^.]+)/);
    if (!match) return null;

    const base64Url = match[1];
    const originalUrl = Buffer.from(base64Url, 'base64').toString('utf-8');
    return originalUrl;
  } catch (error) {
    console.error(`    Error decoding imgproxy URL: ${error.message}`);
    return null;
  }
}

async function scrapeLSUHeadshot(page, athleteUrl, athleteName) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000); // Wait for lazy loading

    const photoUrl = await page.evaluate(() => {
      // LSU uses CSS background images with class "thumb-image"
      const thumbElement = document.querySelector('.thumb-image');
      if (!thumbElement) return null;

      const style = window.getComputedStyle(thumbElement);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none') {
        const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (match) {
          return match[1];
        }
      }

      return null;
    });

    if (!photoUrl) return null;

    // Decode imgproxy URL to get original Google Cloud Storage URL
    const originalUrl = decodeImgproxyUrl(photoUrl);
    return originalUrl || photoUrl;

  } catch (error) {
    console.error(`    Error scraping ${athleteName}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING LSU HEADSHOTS');
  console.log('LSU uses CSS background images instead of <img> tags...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get LSU team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'LSU')
    .single();

  if (!team) {
    console.log('❌ LSU team not found');
    await browser.close();
    return;
  }

  // Get LSU athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, profile_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} LSU athletes in database\n`);

  let updated = 0;

  for (const athlete of athletes) {
    if (!athlete.profile_url) {
      console.log(`  ⚠️  Skipping ${athlete.name} - no profile URL`);
      continue;
    }

    console.log(`  Processing: ${athlete.name}`);

    const photoUrl = await scrapeLSUHeadshot(page, athlete.profile_url, athlete.name);

    if (photoUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);

      console.log(`    ✅ Updated with headshot: ${photoUrl.substring(0, 80)}...`);
      updated++;
    } else {
      console.log(`    ⚠️  No headshot found`);
    }

    await page.waitForTimeout(500);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ LSU HEADSHOT FIX COMPLETE');
  console.log('='.repeat(70));
  console.log(`Updated: ${updated}/${athletes.length} LSU athletes\n`);
}

main();
