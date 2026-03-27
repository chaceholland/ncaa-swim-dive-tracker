require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function scrapeAthleteProfile(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));

      for (const img of images) {
        const src = img.src || '';
        const alt = img.alt || '';

        if (!src || src.startsWith('data:')) continue;

        // Skip logos
        if (src.includes('logo') || src.includes('footer') || src.includes('icon') ||
            alt.toLowerCase().includes('logo')) continue;

        // Look for athlete images
        if ((src.includes('/images/') || src.includes('cloudfront.net')) &&
            (src.includes('.jpg') || src.includes('.png') || src.includes('.webp'))) {
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
  console.log('\n🔧 FIXING ETHAN DUMESNIL (TENNESSEE)\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Tennessee')
    .single();

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .ilike('name', '%Ethan Dumesnil%')
    .single();

  if (!athlete) {
    console.log('❌ Ethan Dumesnil not found in database');
    return;
  }

  console.log(`Current photo: ${athlete.photo_url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get Tennessee roster
  await page.goto('https://utsports.com/sports/mens-swimming-and-diving/roster', {
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

  const profileMatch = profileUrls.find(p =>
    p.name.toLowerCase().includes('dumesnil') || p.name.toLowerCase().includes('ethan')
  );

  if (!profileMatch) {
    console.log('❌ No profile URL found for Ethan Dumesnil');
    await browser.close();
    return;
  }

  console.log(`Scraping: ${profileMatch.url}\n`);
  const photoUrl = await scrapeAthleteProfile(page, profileMatch.url);

  if (photoUrl) {
    console.log(`New photo: ${photoUrl}\n`);

    await supabase
      .from('athletes')
      .update({ photo_url: photoUrl })
      .eq('id', athlete.id);

    console.log('✅ Ethan Dumesnil headshot updated');
  } else {
    console.log('⚠️  No better headshot found');
  }

  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log('✅ ETHAN DUMESNIL FIX COMPLETE');
  console.log('='.repeat(70));
}

main();
