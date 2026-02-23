require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CORNELL_LOGO = 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/cornellbigred.com/images/responsive_2025/logo_main.svg';

async function scrapeAthletePhoto(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || '';
          if (!src.includes('cornellbigred.com') && !src.includes('cloudfront.net') && !src.includes('sidearmdev.com')) return false;
          if (src.includes('logo') || src.includes('placeholder') || src.includes('responsive_2025')) return false;
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
  console.log('\n🔧 RESCRAPING: Cornell Full Roster\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Cornell')
    .single();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Scrape roster page for all profile links
  console.log('Scraping Cornell roster page...\n');
  await page.goto('https://cornellbigred.com/sports/mens-swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await page.waitForTimeout(3000);

  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('a[href*="/sports/mens-swimming-and-diving/roster/"]').forEach(link => {
      const href = link.href;
      if (href.includes('/roster/') && !seen.has(href) && !href.endsWith('/roster/')) {
        seen.add(href);
        // Extract name from link text or URL
        const nameFromText = link.textContent?.trim();
        results.push({ profileUrl: href, nameFromUrl: href });
      }
    });

    return results;
  });

  console.log(`Found ${rosterAthletes.length} athlete profile links\n`);

  let found = 0;

  for (const rosterAthlete of rosterAthletes) {
    // Skip coaches entries
    if (rosterAthlete.profileUrl.includes('/roster/coaches/')) continue;

    // Extract name from URL slug - URLs are like /roster/first-last/12345
    const slug = rosterAthlete.profileUrl.split('/roster/')[1]?.replace(/\/$/, '');
    // Name is the first path segment (before the numeric ID)
    const namePart = slug?.split('/')[0];
    const nameFromSlug = namePart?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Find matching athlete in DB (fuzzy match on name)
    const { data: dbAthletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url, profile_url')
      .eq('team_id', team.id);

    const match = dbAthletes?.find(a => {
      const dbName = a.name.toLowerCase().replace(/\s+/g, '');
      const slugName = (nameFromSlug || '').toLowerCase().replace(/\s+/g, '');
      return dbName === slugName || a.profile_url === rosterAthlete.profileUrl;
    });

    if (!match) {
      console.log(`No DB match for: ${nameFromSlug} (${rosterAthlete.profileUrl})`);
      continue;
    }

    // Only process if broken URL or no profile_url
    const needsUpdate = !match.profile_url ||
      match.photo_url === CORNELL_LOGO ||
      match.photo_url?.includes('securepubads') ||
      match.photo_url?.includes('ad_counter');

    if (!needsUpdate) {
      continue;
    }

    console.log(`${match.name}:`);

    const photoUrl = await scrapeAthletePhoto(page, rosterAthlete.profileUrl);

    if (photoUrl) {
      let finalUrl = photoUrl;
      try {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        url.searchParams.set('height', '1920');
        finalUrl = url.toString();
      } catch {}

      console.log(`  ✅ ${finalUrl.substring(0, 70)}...`);
      await supabase.from('athletes').update({
        photo_url: finalUrl,
        profile_url: rosterAthlete.profileUrl
      }).eq('id', match.id);
      found++;
    } else {
      console.log(`  ❌ No photo - keeping team logo`);
      await supabase.from('athletes').update({
        profile_url: rosterAthlete.profileUrl
      }).eq('id', match.id);
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Fixed with new photos: ${found}`);
}

main();
