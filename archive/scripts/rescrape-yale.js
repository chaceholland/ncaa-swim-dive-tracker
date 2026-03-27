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
  console.log('\n🔧 RESCRAPING: Yale Full Roster\n');

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

  let found = 0;
  let noMatch = 0;

  for (const rosterAthlete of rosterAthletes) {
    // Yale URLs: /roster/nameid (numeric ID glued to last name, e.g. brown21750)
    const afterRoster = rosterAthlete.profileUrl.split('/roster/')[1]?.replace(/\/$/, '').split('/')[0];
    // Strip trailing numeric ID
    const cleanSlug = afterRoster?.replace(/\d+$/, '');
    const nameFromSlug = cleanSlug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const match = dbAthletes?.find(a => {
      const dbName = a.name.toLowerCase().replace(/[\s'-]+/g, '');
      const slugName = (nameFromSlug || '').toLowerCase().replace(/[\s'-]+/g, '');
      return dbName === slugName || a.profile_url === rosterAthlete.profileUrl;
    });

    if (!match) {
      console.log(`No DB match for: ${nameFromSlug} (${rosterAthlete.profileUrl})`);
      noMatch++;
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
      console.log(`  ❌ No photo - setting profile_url only`);
      await supabase.from('athletes').update({
        profile_url: rosterAthlete.profileUrl
      }).eq('id', match.id);
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Updated with photos: ${found}`);
  console.log(`No DB match: ${noMatch}`);
}

main();
