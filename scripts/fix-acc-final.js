require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ROSTER_URLS = {
  'SMU': 'https://smumustangs.com/sports/mens-swimming-and-diving/roster',
  'Cal': 'https://calbears.com/sports/mens-swimming-and-diving/roster',
  'Stanford': 'https://gostanford.com/sports/mens-swimming-and-diving/roster',
  'Georgia Tech': 'https://ramblinwreck.com/sports/mens-swimming-and-diving/roster',
  'Notre Dame': 'https://und.com/sports/mens-swimming-and-diving/roster',
  'Duke': 'https://goduke.com/sports/mens-swimming-and-diving/roster',
  'North Carolina': 'https://goheels.com/sports/mens-swimming-and-diving/roster',
  'NC State': 'https://gopack.com/sports/mens-swimming-and-diving/roster',
  'Florida State': 'https://seminoles.com/sports/mens-swimming-and-diving/roster',
  'Pittsburgh': 'https://pittsburghpanthers.com/sports/mens-swimming-and-diving/roster',
  'Boston College': 'https://bceagles.com/sports/mens-swimming-and-diving/roster'
};

async function scrapeRosterForProfiles(page, rosterUrl) {
  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const athletes = await page.evaluate(() => {
      const results = [];

      // Look for roster links (Sidearm pattern)
      const rosterLinks = document.querySelectorAll('a[href*="/roster/"]');

      for (const link of rosterLinks) {
        const href = link.getAttribute('href');
        if (!href || href.includes('coaches') || href.includes('staff')) continue;

        const name = link.textContent.trim();
        if (!name || name.length < 2) continue;

        // Get full URL
        const fullUrl = href.startsWith('http') ? href : window.location.origin + href;

        results.push({ name, profileUrl: fullUrl });
      }

      return results;
    });

    return athletes;
  } catch (error) {
    console.log(`    ❌ Error scraping roster: ${error.message}`);
    return [];
  }
}

async function scrapeAthleteProfile(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate(() => {
      // Find the athlete headshot image
      const images = Array.from(document.querySelectorAll('img'));

      for (const img of images) {
        const src = img.src || '';
        const alt = img.alt || '';

        // Skip logos and icons
        if (src.includes('logo') || src.includes('acc.svg') ||
            src.includes('footer') || src.includes('icon') ||
            alt.toLowerCase().includes('logo')) {
          continue;
        }

        // Look for athlete images (usually contain the athlete's name or are in /images/ path)
        if (src.includes('/images/') && (src.includes('.jpg') || src.includes('.png') || src.includes('.webp'))) {
          // Upgrade quality if it has width parameter
          if (src.includes('?width=')) {
            return src.replace(/width=\d+/, 'width=800');
          }
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

async function fixTeam(teamName, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FIXING: ${teamName}`);
  console.log('='.repeat(70));

  const rosterUrl = ROSTER_URLS[teamName];
  if (!rosterUrl) {
    console.log(`  ⚠️  No roster URL configured`);
    return;
  }

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`  ❌ Team not found in database`);
    return;
  }

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id);

  const needsFixing = dbAthletes.filter(a =>
    !a.photo_url ||
    a.photo_url.includes('logo') ||
    a.photo_url.includes('header_logo') ||
    a.photo_url.startsWith('data:image')
  );

  console.log(`\n${needsFixing.length}/${dbAthletes.length} athletes need fixing`);

  if (needsFixing.length === 0) {
    console.log(`  ✅ All athletes already have headshots`);
    return;
  }

  const page = await browser.newPage();

  console.log(`\nScraping roster page...`);
  const rosterAthletes = await scrapeRosterForProfiles(page, rosterUrl);
  console.log(`Found ${rosterAthletes.length} profile URLs on roster page`);

  let updated = 0;
  let withHeadshot = 0;
  let withLogo = 0;

  for (const dbAthlete of needsFixing) {
    // Find matching profile URL
    const rosterMatch = rosterAthletes.find(r => {
      const rLower = r.name.toLowerCase();
      const dbLower = dbAthlete.name.toLowerCase();
      return rLower.includes(dbLower) || dbLower.includes(rLower);
    });

    if (!rosterMatch) {
      console.log(`  ${dbAthlete.name}: No profile URL found - using team logo`);
      await supabase
        .from('athletes')
        .update({ photo_url: team.logo_url })
        .eq('id', dbAthlete.id);
      withLogo++;
      updated++;
      continue;
    }

    console.log(`  ${dbAthlete.name}: Scraping profile...`);
    const photoUrl = await scrapeAthleteProfile(page, rosterMatch.profileUrl);

    if (photoUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', dbAthlete.id);
      console.log(`    ✅ Found headshot`);
      withHeadshot++;
    } else {
      await supabase
        .from('athletes')
        .update({ photo_url: team.logo_url })
        .eq('id', dbAthlete.id);
      console.log(`    ⚠️  No headshot - using team logo`);
      withLogo++;
    }
    updated++;
  }

  await page.close();

  console.log(`\n✅ ${teamName}: ${updated} updated (${withHeadshot} headshots, ${withLogo} logos)`);
}

async function main() {
  console.log('\n🔧 FIXING ACC TEAMS - FINAL ATTEMPT');
  console.log('Scraping individual athlete profile pages...\n');

  const browser = await chromium.launch({ headless: true });

  const teams = ['SMU', 'Cal', 'Stanford', 'Georgia Tech', 'Notre Dame', 'Duke', 'North Carolina', 'NC State', 'Florida State', 'Pittsburgh', 'Boston College'];

  for (const team of teams) {
    await fixTeam(team, browser);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ ACC TEAMS FIX COMPLETE');
  console.log('='.repeat(70));
}

main();
