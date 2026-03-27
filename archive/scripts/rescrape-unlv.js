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
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || '';
          if (!src.includes('unlvrebels.com/images/')) return false;
          if (src.includes('/logos/') || src.includes('logo') || src.includes('site.png')
              || src.includes('.svg') || src.includes('footer_')) return false;
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

    if (photoUrl) {
      // Upgrade to high-res
      try {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        return url.toString();
      } catch {
        return photoUrl;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n🔧 RESCRAPING: UNLV Full Roster\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'UNLV')
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id);

  console.log(`DB athletes: ${dbAthletes.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Scraping UNLV combined roster page...\n');
  await page.goto('https://unlvrebels.com/sports/swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await page.waitForTimeout(5000);

  // Men's athlete IDs from 2025-26 combined roster (identified from page inspection)
  const MEN_IDS = new Set([
    17206, 17207, 17209, 17216, 17221, 17223, 17228, 17229,
    17241, 17244, 17245, 17246, 17247, 17249, 17250, 17255,
    17258, 17269, 17270, 17272, 17273, 17274, 17275, 17276
  ]);

  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('a[href*="/sports/swimming-and-diving/roster/"]').forEach(a => {
      const href = a.href;
      if (!href || href.includes('/coaches/') || href.includes('/staff/') || href.includes('#')) return;
      if (seen.has(href)) return;
      const text = a.textContent?.trim();
      if (!text || text === 'View Full Bio' || text === 'Full Bio' || text === '') return;
      seen.add(href);
      // Extract clean name from slug
      const slug = href.split('/roster/')[1]?.split('/')[0] || '';
      const nameFromSlug = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      // Identify men by numeric ID at end of URL
      const athleteId = parseInt(href.split('/').pop(), 10);
      results.push({ profileUrl: href, name: text, nameFromSlug, athleteId });
    });

    return results;
  });

  // Apply men's ID check outside evaluate
  const rosterAthletesTagged = rosterAthletes.map(a => ({
    ...a,
    isMen: MEN_IDS.has(a.athleteId)
  }));

  console.log(`Found ${rosterAthletesTagged.length} athlete profile links\n`);
  console.log(`Men's: ${rosterAthletesTagged.filter(a => a.isMen).length}, Women's: ${rosterAthletesTagged.filter(a => !a.isMen).length}\n`);

  let updated = 0;
  let inserted = 0;
  let noPhoto = 0;

  for (const rosterAthlete of rosterAthletesTagged) {
    const match = dbAthletes?.find(a => {
      const dbName = a.name.toLowerCase().replace(/[\s'.-]+/g, '');
      const rosterName = (rosterAthlete.name || '').toLowerCase().replace(/[\s'.-]+/g, '');
      const slugName = (rosterAthlete.nameFromSlug || '').toLowerCase().replace(/[\s'.-]+/g, '');
      return dbName === rosterName || dbName === slugName || a.profile_url === rosterAthlete.profileUrl;
    });

    const photoUrl = await scrapeAthletePhoto(page, rosterAthlete.profileUrl);
    const finalPhoto = photoUrl || team.logo_url;
    if (!photoUrl) noPhoto++;

    if (match) {
      console.log(`${match.name}: ${photoUrl ? '✅' : '❌ no photo'}`);
      await supabase.from('athletes').update({
        photo_url: finalPhoto,
        profile_url: rosterAthlete.profileUrl
      }).eq('id', match.id);
      updated++;
    } else if (rosterAthlete.isMen) {
      // Only insert new men's athletes
      console.log(`${rosterAthlete.name} [NEW MEN'S]: ${photoUrl ? '✅' : '❌ no photo'}`);
      const { error } = await supabase.from('athletes').insert({
        name: rosterAthlete.name,
        team_id: team.id,
        photo_url: finalPhoto,
        profile_url: rosterAthlete.profileUrl,
      });
      if (error) console.log(`  ⚠️ Insert error: ${error.message}`);
      else inserted++;
    }
    // Women's athletes with no DB match: skip
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Updated existing: ${updated}`);
  console.log(`Inserted new men's: ${inserted}`);
  console.log(`No photo (using logo): ${noPhoto}`);
}

main();
