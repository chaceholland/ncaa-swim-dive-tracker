require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function scrapeAthletePhoto(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || '';
          if (!src.includes('yalebulldogs.com') && !src.includes('cloudfront.net') && !src.includes('sidearmdev.com')) return false;
          if (src.includes('logo') || src.includes('placeholder') || src.includes('responsive_') || src.includes('sponsor')) return false;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w < 80 || h < 80) return false;
          const ratio = w / h;
          return ratio >= 0.4 && ratio <= 1.1;
        })
        .map(img => ({
          src: img.src,
          area: (img.naturalWidth || img.width) * (img.naturalHeight || img.height)
        }))
        .sort((a, b) => b.area - a.area);

      return candidates[0]?.src || null;
    });

    return photoUrl;
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n➕ ADDING MISSING: Yale Athletes\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Yale')
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Scraping Yale roster page...\n');
  await page.goto('https://yalebulldogs.com/sports/mens-swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await page.waitForTimeout(3000);

  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('a[href*="/sports/mens-swimming-and-diving/roster/"]').forEach(link => {
      const href = link.href;
      if (href.includes('/roster/') && !seen.has(href) && !href.endsWith('/roster/') && !href.includes('/coaches/') && !href.includes('/staff/')) {
        seen.add(href);
        results.push({ profileUrl: href });
      }
    });

    return results;
  });

  console.log(`Found ${rosterAthletes.length} athlete profile links\n`);

  // Also scrape names from the roster page directly
  const rosterData = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('a[href*="/sports/mens-swimming-and-diving/roster/"]').forEach(link => {
      const href = link.href;
      if (href.includes('/roster/') && !seen.has(href) && !href.endsWith('/roster/') && !href.includes('/coaches/') && !href.includes('/staff/')) {
        seen.add(href);
        // Try to get the athlete name from link text or nearby elements
        const text = link.textContent?.trim();
        results.push({ profileUrl: href, linkText: text });
      }
    });

    return results;
  });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const rosterAthlete of rosterData) {
    // Yale URLs: /roster/name/id (with slash separator)
    const afterRoster = rosterAthlete.profileUrl.split('/roster/')[1]?.replace(/\/$/, '').split('/')[0];
    // Strip trailing digits just in case
    const cleanSlug = afterRoster?.replace(/\d+$/, '');
    const nameFromSlug = cleanSlug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const match = dbAthletes?.find(a => {
      const dbName = a.name.toLowerCase().replace(/[\s'-]+/g, '');
      const slugName = (nameFromSlug || '').toLowerCase().replace(/[\s'-]+/g, '');
      return dbName === slugName || a.profile_url === rosterAthlete.profileUrl;
    });

    if (match) {
      skipped++;
      continue; // Already in DB, was handled by rescrape script
    }

    // New athlete - need to add them
    console.log(`New athlete: ${nameFromSlug}`);

    const photoUrl = await scrapeAthletePhoto(page, rosterAthlete.profileUrl);

    let finalPhotoUrl = team.logo_url;
    if (photoUrl) {
      try {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        url.searchParams.set('height', '1920');
        finalPhotoUrl = url.toString();
        console.log(`  ✅ ${finalPhotoUrl.substring(0, 70)}...`);
      } catch {
        finalPhotoUrl = photoUrl;
      }
    } else {
      console.log(`  ❌ No photo - using team logo`);
    }

    const { error } = await supabase.from('athletes').insert({
      name: nameFromSlug,
      team_id: team.id,
      photo_url: finalPhotoUrl,
      profile_url: rosterAthlete.profileUrl,
    });

    if (error) {
      console.log(`  ⚠️ Insert error: ${error.message}`);
    } else {
      inserted++;
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Inserted new athletes: ${inserted}`);
  console.log(`Already in DB (skipped): ${skipped}`);
}

main();
