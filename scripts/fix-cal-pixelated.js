require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CAL_PIXELATED = [
  'Caiden  Bowers',
  'Jack Brown',
  'Kenny Barnicle',
  'Lars Antoniak',
  'Nikolas Antoniou',
  'Lucca  Battaglini'
];

async function scrapeAthleteProfile(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));

      for (const img of images) {
        const src = img.src || '';

        // Skip logos
        if (src.includes('logo') || src.includes('Logo') || src.includes('MainNav')) continue;

        // Look for athlete images
        if (src.includes('/images/') &&
            (src.includes('.jpg') || src.includes('.png') || src.includes('.webp')) &&
            (src.includes('Cropped') || src.includes('20'))) {
          // Upgrade quality
          if (src.includes('?width=')) {
            return src.replace(/width=\d+/, 'width=1200');
          }
          return src;
        }
      }

      return null;
    });

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING CAL PIXELATED ATHLETES\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Cal')
    .single();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get roster profile URLs
  await page.goto('https://calbears.com/sports/mens-swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  });
  await page.waitForTimeout(2000);

  const profileUrls = await page.evaluate(() => {
    const results = [];
    const links = document.querySelectorAll('a[href*="/roster/"]');

    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href || href.includes('coaches')) continue;

      const name = link.textContent.trim();
      if (!name || name.length < 2) continue;

      const fullUrl = href.startsWith('http') ? href : window.location.origin + href;
      results.push({ name, url: fullUrl });
    }

    return results;
  });

  console.log(`Found ${profileUrls.length} profile URLs\n`);

  let updated = 0;

  for (const athleteName of CAL_PIXELATED) {
    console.log(`${athleteName}:`);

    // Find in database
    const { data: athlete } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id)
      .ilike('name', `%${athleteName.trim()}%`)
      .single();

    if (!athlete) {
      console.log('  ⚠️  Not found in database\n');
      continue;
    }

    // Find profile URL
    const profileMatch = profileUrls.find(p => {
      const pLower = p.name.toLowerCase().replace(/\s+/g, ' ');
      const aLower = athlete.name.toLowerCase().replace(/\s+/g, ' ');
      return pLower.includes(aLower) || aLower.includes(pLower);
    });

    if (!profileMatch) {
      console.log('  ⚠️  No profile URL found\n');
      continue;
    }

    console.log(`  Scraping: ${profileMatch.url.substring(0, 60)}...`);
    const photoUrl = await scrapeAthleteProfile(page, profileMatch.url);

    if (photoUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);
      console.log('  ✅ High-res image found\n');
      updated++;
    } else {
      console.log('  ⚠️  No better image found\n');
    }
  }

  await browser.close();

  console.log('='.repeat(70));
  console.log(`✅ CAL PIXELATED FIX: ${updated}/${CAL_PIXELATED.length} athletes updated`);
  console.log('='.repeat(70));
}

main();
