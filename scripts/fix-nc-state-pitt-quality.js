require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function upgradeQuality(photoUrl) {
  if (!photoUrl || photoUrl.includes('/logos/')) {
    return photoUrl;
  }

  // Upgrade sidearmdev crop URLs
  if (photoUrl.includes('images.sidearmdev.com/crop')) {
    try {
      const url = new URL(photoUrl);
      url.searchParams.set('width', '1920');
      url.searchParams.set('height', '1920');
      return url.toString();
    } catch (error) {
      return photoUrl;
    }
  }

  return photoUrl;
}

async function scrapeAthleteProfile(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));

      for (const img of images) {
        const src = img.src || '';
        const alt = img.alt || '';

        // Skip logos and icons
        if (src.includes('logo') || src.includes('footer') || src.includes('icon') ||
            alt.toLowerCase().includes('logo')) {
          continue;
        }

        // Look for high-quality athlete images
        if (src.includes('sidearmdev.com/crop')) {
          // Upgrade quality immediately
          try {
            const url = new URL(src);
            url.searchParams.set('width', '1920');
            url.searchParams.set('height', '1920');
            return url.toString();
          } catch {
            return src;
          }
        }

        // Look for other athlete images
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

async function fixTeam(teamName, rosterUrl, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FIXING: ${teamName}`);
  console.log('='.repeat(70));

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`\nTotal athletes: ${dbAthletes.length}`);

  // Find athletes with low-quality or Supabase-hosted images
  const needsFixing = dbAthletes.filter(a =>
    a.photo_url &&
    (a.photo_url.includes('supabase.co/storage') ||
     (a.photo_url.includes('crop') && a.photo_url.includes('width=800')))
  );

  console.log(`Need quality upgrade: ${needsFixing.length}\n`);

  if (needsFixing.length === 0) {
    console.log('✅ All athletes already have high-quality images');
    return;
  }

  const page = await browser.newPage();

  // Get profile URLs from roster
  await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const rosterLinks = document.querySelectorAll('a[href*="/roster/"]');

    for (const link of rosterLinks) {
      const href = link.getAttribute('href');
      if (!href || href.includes('coaches') || href.includes('staff')) continue;

      const name = link.textContent.trim();
      if (!name || name.length < 2) continue;

      const fullUrl = href.startsWith('http') ? href : window.location.origin + href;
      results.push({ name, profileUrl: fullUrl });
    }

    return results;
  });

  console.log(`Found ${rosterAthletes.length} profile URLs\n`);

  let updated = 0;
  let upgraded = 0;
  let newHeadshots = 0;

  for (const dbAthlete of needsFixing) {
    console.log(`${dbAthlete.name}:`);

    // Try quick quality upgrade for sidearmdev URLs
    const quickUpgrade = upgradeQuality(dbAthlete.photo_url);
    if (quickUpgrade !== dbAthlete.photo_url) {
      await supabase
        .from('athletes')
        .update({ photo_url: quickUpgrade })
        .eq('id', dbAthlete.id);
      console.log('  ✅ Upgraded quality (800→1920)\n');
      upgraded++;
      updated++;
      continue;
    }

    // For Supabase-hosted images, scrape for better quality
    const rosterMatch = rosterAthletes.find(r => {
      const rLower = r.name.toLowerCase();
      const dbLower = dbAthlete.name.toLowerCase();
      return rLower.includes(dbLower) || dbLower.includes(rLower);
    });

    if (!rosterMatch) {
      console.log('  ⚠️  No profile URL found\n');
      continue;
    }

    console.log(`  Scraping: ${rosterMatch.profileUrl.substring(0, 60)}...`);
    const photoUrl = await scrapeAthleteProfile(page, rosterMatch.profileUrl);

    if (photoUrl && photoUrl !== dbAthlete.photo_url) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', dbAthlete.id);
      console.log('  ✅ Found higher quality image\n');
      newHeadshots++;
      updated++;
    } else {
      console.log('  ⚠️  No better image found\n');
    }
  }

  await page.close();

  console.log(`\n✅ ${teamName}: ${updated} updated (${upgraded} quality upgrades, ${newHeadshots} new images)`);
}

async function main() {
  console.log('\n🔧 FIXING NC STATE AND PITTSBURGH IMAGE QUALITY');
  console.log('Upgrading to high-resolution images...\n');

  const browser = await chromium.launch({ headless: true });

  await fixTeam('NC State', 'https://gopack.com/sports/mens-swimming-and-diving/roster', browser);
  await fixTeam('Pittsburgh', 'https://pittsburghpanthers.com/sports/mens-swimming-and-diving/roster', browser);

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ QUALITY UPGRADE COMPLETE');
  console.log('='.repeat(70));
}

main();
