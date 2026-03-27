require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Known placeholder image — not an athlete headshot
const PLACEHOLDER_PATH = '/images/2019/8/1/Roberts_Bill0219.jpg';

async function scrapeAthletePhoto(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate((placeholder) => {
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || '';
          // Must be navysports.com/images/ (not logos, not placeholder, not banner)
          if (!src.includes('navysports.com/images/')) return false;
          if (src.includes(placeholder)) return false;
          if (src.includes('logo') || src.includes('Logo') || src.includes('responsive_')
              || src.includes('Top-') || src.includes('Bottom-') || src.includes('site.png')) return false;
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
    }, PLACEHOLDER_PATH);

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
  console.log('\n🔧 RESCRAPING: Navy Full Roster\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Navy')
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id);

  console.log(`DB athletes: ${dbAthletes.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Scraping Navy 2025-26 roster page...\n');
  await page.goto('https://navysports.com/sports/mens-swimming-and-diving/roster/2025-26', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await page.waitForTimeout(2000);

  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (!href.includes('/roster/') || href.includes('/coaches/') || href.match(/roster\/20\d\d/) || seen.has(href)) return;
      seen.add(href);
      results.push({ profileUrl: href, name: a.textContent?.trim() });
    });
    return results;
  });

  console.log(`Found ${rosterAthletes.length} athlete profile links\n`);

  let updated = 0;
  let inserted = 0;
  let noPhoto = 0;

  for (const rosterAthlete of rosterAthletes) {
    const match = dbAthletes?.find(a => {
      const dbName = a.name.toLowerCase().replace(/[\s'.-]+/g, '');
      const rosterName = (rosterAthlete.name || '').toLowerCase().replace(/[\s'.-]+/g, '');
      return dbName === rosterName || a.profile_url === rosterAthlete.profileUrl;
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
    } else {
      console.log(`${rosterAthlete.name} [NEW]: ${photoUrl ? '✅' : '❌ no photo'}`);
      const { error } = await supabase.from('athletes').insert({
        name: rosterAthlete.name,
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
