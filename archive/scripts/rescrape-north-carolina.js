require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Men's slugs identified from the combined roster page
const MENS_SLUGS = new Set([
  'granger-bartee', 'brady-begin', 'chris-booler', 'michael-cotter',
  'hudson-degroote', 'ben-delmar', 'louis-dramm', 'conrad-eck',
  'pj-foy', 'carter-freudenstein', 'benton-grutter', 'nate-hohm',
  'sam-huggins', 'martin-kartavi', 'carter-loftin', 'sebastian-lunak',
  'adam-maraana', 'giulian-martin', 'ciro-mejia', 'david-melnychuk',
  'reid-miller', 'tom-mienis', 'josh-parent', 'david-quaresma',
  'xavier-ruiz', 'jt-schmid', 'sean-setzer', 'julian-swiderski',
  'rodolfo-vzquez-montao', 'colin-whelehan',
]);

async function scrapeAthletePhoto(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || '';
          if (!src.includes('sidearmdev.com') && !src.includes('dxbhsrqyrr690.cloudfront.net')) return false;
          if (src.includes('logo') || src.includes('Logo') || src.includes('sponsor')
              || src.includes('footer') || src.includes('nav_logo') || src.includes('.svg')
              || src.includes('/logos/') || src.includes('acc') || src.includes('ACC')
              || src.includes('Nike') || src.includes('Jordan') || src.includes('UNC.png')) return false;
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
  console.log('\n🔧 RESCRAPING: North Carolina Full Roster\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'North Carolina')
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Scraping UNC roster page...\n');
  await page.goto('https://goheels.com/sports/swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await page.waitForTimeout(3000);

  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/sports/swimming-and-diving/roster/"]').forEach(link => {
      const href = link.href;
      if (href.includes('/roster/') && !seen.has(href) && !href.endsWith('/roster/') && !href.includes('/coaches/') && !href.includes('/staff/')) {
        seen.add(href);
        results.push({ profileUrl: href });
      }
    });
    return results;
  });

  console.log(`Found ${rosterAthletes.length} total athlete links (men's + women's)\n`);

  let updated = 0;
  let inserted = 0;
  let noMatch = 0;

  for (const rosterAthlete of rosterAthletes) {
    // URL format: /sports/swimming-and-diving/roster/name/id
    const afterRoster = rosterAthlete.profileUrl.split('/roster/')[1]?.replace(/\/$/, '');
    const slug = afterRoster?.split('/')[0];

    // Skip women's athletes
    if (!MENS_SLUGS.has(slug)) continue;

    const nameFromSlug = slug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const match = dbAthletes?.find(a => {
      const dbName = a.name.toLowerCase().replace(/[\s'.-]+/g, '');
      const slugName = (nameFromSlug || '').toLowerCase().replace(/[\s'.-]+/g, '');
      return dbName === slugName || a.profile_url === rosterAthlete.profileUrl;
    });

    console.log(`${match ? match.name : nameFromSlug}${match ? '' : ' [NEW]'}:`);

    const photoUrl = await scrapeAthletePhoto(page, rosterAthlete.profileUrl);

    let finalPhotoUrl = match ? null : team.logo_url;
    if (photoUrl) {
      finalPhotoUrl = photoUrl;
      console.log(`  ✅ ${finalPhotoUrl.substring(0, 80)}...`);
    } else {
      console.log(`  ❌ No photo`);
    }

    if (match) {
      if (finalPhotoUrl) {
        await supabase.from('athletes').update({
          photo_url: finalPhotoUrl,
          profile_url: rosterAthlete.profileUrl
        }).eq('id', match.id);
      } else {
        await supabase.from('athletes').update({
          profile_url: rosterAthlete.profileUrl
        }).eq('id', match.id);
      }
      updated++;
    } else {
      const { error } = await supabase.from('athletes').insert({
        name: nameFromSlug,
        team_id: team.id,
        photo_url: finalPhotoUrl,
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
  console.log(`Skipped (women's): ${rosterAthletes.length - updated - inserted - noMatch}`);
}

main();
