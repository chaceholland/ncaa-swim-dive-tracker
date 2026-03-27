require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeKentuckyHeadshot(page, athleteUrl, athleteName) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate((name) => {
      // Find the main athlete image - it should have the athlete's name in the alt text
      const img = document.querySelector(`img[alt*="${name}"]`);
      if (img && img.src && !img.src.includes('data:image')) {
        return img.src;
      }

      // Fallback: look for the hero image
      const heroImg = document.querySelector('.sidearm-roster-player-image, img[class*="player"], img[class*="roster"]');
      if (heroImg && heroImg.src && !heroImg.src.includes('data:image')) {
        return heroImg.src;
      }

      return null;
    }, athleteName);

    return photoUrl;
  } catch (error) {
    console.error(`    Error scraping ${athleteName}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING KENTUCKY HEADSHOTS (v2)');
  console.log('Using original imgproxy URLs from ukathletics.com...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get Kentucky team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Kentucky')
    .single();

  if (!team) {
    console.log('❌ Kentucky team not found');
    await browser.close();
    return;
  }

  // Get Kentucky athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, profile_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} Kentucky athletes in database\n`);

  let updated = 0;

  for (const athlete of athletes) {
    if (!athlete.profile_url) {
      console.log(`  ⚠️  Skipping ${athlete.name} - no profile URL`);
      continue;
    }

    console.log(`  Processing: ${athlete.name}`);

    const photoUrl = await scrapeKentuckyHeadshot(page, athlete.profile_url, athlete.name);

    if (photoUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);

      console.log(`    ✅ Updated: ${photoUrl.substring(0, 80)}...`);
      updated++;
    } else {
      console.log(`    ⚠️  No headshot found`);
    }

    await page.waitForTimeout(500);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ KENTUCKY HEADSHOT FIX COMPLETE (v2)');
  console.log('='.repeat(70));
  console.log(`Updated: ${updated}/${athletes.length} Kentucky athletes\n`);
}

main();
