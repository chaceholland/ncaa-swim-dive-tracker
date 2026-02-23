require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔧 RESCRAPING: Arizona Full Roster\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Arizona')
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id);

  console.log(`DB athletes: ${dbAthletes.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Scraping Arizona roster page...\n');
  await page.goto('https://arizonawildcats.com/sports/mens-swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await page.waitForTimeout(3000);

  // Scrape profile links + photos from roster page in one pass
  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('li').forEach(li => {
      const link = li.querySelector('a[href*="/sports/mens-swimming-and-diving/roster/"]');
      if (!link) return;
      const href = link.href;
      if (!href || href.includes('/coaches/') || href.includes('/staff/') || seen.has(href)) return;
      if (href.endsWith('/roster') || href.endsWith('/roster/')) return;

      seen.add(href);

      // Find the athlete's thumbnail within this list item
      // Use data-src as primary source (lazy loading means src may be empty for off-screen items)
      const img = li.querySelector('img');
      let photoUrl = null;
      if (img) {
        const rawSrc = img.getAttribute('data-src') || img.src || '';
        if ((rawSrc.includes('d11rxijfksshz7.cloudfront.net') || rawSrc.includes('dxbhsrqyrr690.cloudfront.net'))
            && !rawSrc.includes('.svg') && !rawSrc.includes('logo') && !rawSrc.includes('nav_')) {
          // Add high-res params
          try {
            const url = new URL(rawSrc);
            url.searchParams.set('width', '1920');
            url.searchParams.set('quality', '95');
            url.searchParams.set('height', '1920');
            photoUrl = url.toString();
          } catch {
            photoUrl = rawSrc;
          }
        }
      }

      results.push({ profileUrl: href, photoUrl });
    });

    return results;
  });

  console.log(`Found ${rosterAthletes.length} athlete profile links\n`);

  let updated = 0;
  let inserted = 0;
  let noPhoto = 0;

  for (const rosterAthlete of rosterAthletes) {
    // URL format: /sports/mens-swimming-and-diving/roster/name/id
    const afterRoster = rosterAthlete.profileUrl.split('/roster/')[1]?.replace(/\/$/, '');
    const namePart = afterRoster?.split('/')[0];
    const nameFromSlug = namePart?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const match = dbAthletes?.find(a => {
      const dbName = a.name.toLowerCase().replace(/[\s'.-]+/g, '');
      const slugName = (nameFromSlug || '').toLowerCase().replace(/[\s'.-]+/g, '');
      return dbName === slugName || a.profile_url === rosterAthlete.profileUrl;
    });

    const finalPhoto = rosterAthlete.photoUrl || team.logo_url;
    if (!rosterAthlete.photoUrl) noPhoto++;

    if (match) {
      console.log(`${match.name}: ${rosterAthlete.photoUrl ? '✅' : '❌ no photo'}`);
      await supabase.from('athletes').update({
        photo_url: finalPhoto,
        profile_url: rosterAthlete.profileUrl
      }).eq('id', match.id);
      updated++;
    } else {
      console.log(`${nameFromSlug} [NEW]: ${rosterAthlete.photoUrl ? '✅' : '❌ no photo'}`);
      const { error } = await supabase.from('athletes').insert({
        name: nameFromSlug,
        team_id: team.id,
        photo_url: finalPhoto,
        profile_url: rosterAthlete.profileUrl,
      });
      if (error) console.log(`  ⚠️ Insert error: ${error.message}`);
      else inserted++;
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Updated existing: ${updated}`);
  console.log(`Inserted new: ${inserted}`);
  console.log(`No photo (using logo): ${noPhoto}`);
}

main();
