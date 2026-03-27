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
          if (!src.includes('/imgproxy/') && !src.includes('lsusports.net')) return false;
          if (src.includes('logo') || src.includes('Logo') || src.includes('placeholder')
              || src.includes('sponsor') || src.includes('.svg') || src.includes('/logos/')) return false;
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
  console.log('\n🔧 RESCRAPING: LSU Full Roster\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'LSU')
    .single();

  console.log(`Team ID: ${team.id}`);

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id);

  console.log(`DB athletes: ${dbAthletes.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Scraping LSU roster page...\n');
  await page.goto('https://lsusports.net/sports/sd/roster/', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await page.waitForTimeout(3000);

  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/sports/sd/roster/player/"]').forEach(link => {
      const href = link.href;
      if (!seen.has(href)) {
        seen.add(href);
        results.push({ profileUrl: href });
      }
    });
    return results;
  });

  console.log(`Found ${rosterAthletes.length} total athlete profile links (men's + women's)\n`);

  let updated = 0;
  let noMatch = 0;

  for (const rosterAthlete of rosterAthletes) {
    // URL format: /sports/sd/roster/player/name/
    const afterPlayer = rosterAthlete.profileUrl.split('/roster/player/')[1]?.replace(/\/$/, '');
    const nameFromSlug = afterPlayer?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const match = dbAthletes?.find(a => {
      const dbName = a.name.toLowerCase().replace(/[\s'.-]+/g, '');
      const slugName = (nameFromSlug || '').toLowerCase().replace(/[\s'.-]+/g, '');
      return dbName === slugName || a.profile_url === rosterAthlete.profileUrl;
    });

    if (!match) {
      // Women's athlete or not in DB - skip
      noMatch++;
      continue;
    }

    console.log(`${match.name}:`);

    const photoUrl = await scrapeAthletePhoto(page, rosterAthlete.profileUrl);

    if (photoUrl) {
      console.log(`  ✅ ${photoUrl.substring(0, 80)}...`);
      await supabase.from('athletes').update({
        photo_url: photoUrl,
        profile_url: rosterAthlete.profileUrl
      }).eq('id', match.id);
      updated++;
    } else {
      console.log(`  ❌ No photo - updating profile_url only`);
      await supabase.from('athletes').update({
        profile_url: rosterAthlete.profileUrl
      }).eq('id', match.id);
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Updated: ${updated}`);
  console.log(`No DB match (women's/skip): ${noMatch}`);
}

main();
