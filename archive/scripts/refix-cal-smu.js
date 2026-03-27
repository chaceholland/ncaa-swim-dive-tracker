require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeAthleteProfile(page, profileUrl, athleteName) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate((name) => {
      const images = Array.from(document.querySelectorAll('img'));

      // Filter out navigation, logos, and non-athlete images
      const athleteImages = images.filter(img => {
        const src = img.src || '';
        const alt = img.alt || '';
        
        // Skip these
        if (src.includes('logo') || 
            src.includes('Logo') ||
            src.includes('MainNav') ||
            src.includes('footer') || 
            src.includes('acc.svg') ||
            src.includes('icon') ||
            alt.toLowerCase().includes('logo')) {
          return false;
        }
        
        // Only keep images from /images/ path that are photos
        return src.includes('/images/') && 
               (src.includes('.jpg') || src.includes('.png') || src.includes('.webp')) &&
               (src.includes('Cropped') || src.includes('20') || alt.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
      });

      if (athleteImages.length > 0) {
        let url = athleteImages[0].src;
        // Upgrade quality
        if (url.includes('?width=')) {
          url = url.replace(/width=\d+/, 'width=800');
        }
        return url;
      }

      return null;
    }, athleteName);

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
    .eq('team_id', team.id);

  // Find athletes with wrong images
  const needsFixing = dbAthletes.filter(a =>
    !a.photo_url ||
    a.photo_url.includes('MainNav') ||
    a.photo_url.includes('PEP_Logo') ||
    a.photo_url.includes('cal_logo') ||
    a.photo_url.includes('header_logo') ||
    a.photo_url.startsWith('data:image')
  );

  console.log(`\n${needsFixing.length}/${dbAthletes.length} athletes need fixing`);

  if (needsFixing.length === 0) {
    console.log(`  ✅ All athletes already have proper headshots`);
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
  let withHeadshot = 0;
  let withLogo = 0;

  for (const dbAthlete of needsFixing) {
    const rosterMatch = rosterAthletes.find(r => {
      const rLower = r.name.toLowerCase();
      const dbLower = dbAthlete.name.toLowerCase();
      return rLower.includes(dbLower) || dbLower.includes(rLower);
    });

    if (!rosterMatch) {
      console.log(`  ${dbAthlete.name}: No profile URL - using team logo`);
      await supabase.from('athletes').update({ photo_url: team.logo_url }).eq('id', dbAthlete.id);
      withLogo++;
      updated++;
      continue;
    }

    console.log(`  ${dbAthlete.name}: Scraping...`);
    const photoUrl = await scrapeAthleteProfile(page, rosterMatch.profileUrl, dbAthlete.name);

    if (photoUrl) {
      await supabase.from('athletes').update({ photo_url: photoUrl }).eq('id', dbAthlete.id);
      console.log(`    ✅ Found headshot`);
      withHeadshot++;
    } else {
      await supabase.from('athletes').update({ photo_url: team.logo_url }).eq('id', dbAthlete.id);
      console.log(`    ⚠️  No headshot - using team logo`);
      withLogo++;
    }
    updated++;
  }

  await page.close();
  console.log(`\n✅ ${teamName}: ${updated} updated (${withHeadshot} headshots, ${withLogo} logos)`);
}

async function main() {
  console.log('\n🔧 RE-FIXING CAL AND SMU');
  console.log('Improved scraper to find actual athlete headshots...\n');

  const browser = await chromium.launch({ headless: true });

  await fixTeam('SMU', 'https://smumustangs.com/sports/mens-swimming-and-diving/roster', browser);
  await fixTeam('Cal', 'https://calbears.com/sports/mens-swimming-and-diving/roster', browser);

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ CAL AND SMU RE-FIX COMPLETE');
  console.log('='.repeat(70));
}

main();
