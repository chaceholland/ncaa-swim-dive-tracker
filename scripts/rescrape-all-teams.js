require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Team roster URLs
const TEAM_ROSTER_URLS = {
  'Navy': 'https://navysports.com/sports/mens-swimming-and-diving/roster',
  'Penn State': 'https://gopsusports.com/sports/mens-swimming-and-diving/roster',
  'Stanford': 'https://gostanford.com/sports/mens-swimming-and-diving/roster',
  'Arizona State': 'https://thesundevils.com/sports/swimming-and-diving/roster',
  'Louisville': 'https://gocards.com/sports/mens-swimming-and-diving/roster',
  'Duke': 'https://goduke.com/sports/mens-swimming-and-diving/roster',
  'Harvard': 'https://gocrimson.com/sports/mens-swimming-and-diving/roster',
  'Yale': 'https://yalebulldogs.com/sports/mens-swimming-and-diving/roster',
  'Cornell': 'https://cornellbigred.com/sports/mens-swimming-and-diving/roster',
  'Georgia': 'https://georgiadogs.com/sports/mens-swimming-and-diving/roster',
  'Missouri': 'https://mutigers.com/sports/mens-swimming-and-diving/roster',
  'Kentucky': 'https://ukathletics.com/sports/mens-swimming-and-diving/roster',
  'Georgia Tech': 'https://ramblinwreck.com/sports/mens-swimming-and-diving/roster',
  'LSU': 'https://lsusports.net/sports/swimming-and-diving/roster',
  'Notre Dame': 'https://und.com/sports/mens-swimming-and-diving/roster',
  'Ohio State': 'https://ohiostatebuckeyes.com/sports/m-swim/roster/',
  'Pittsburgh': 'https://pittsburghpanthers.com/sports/mens-swimming-and-diving/roster',
  'NC State': 'https://gopack.com/sports/mens-swimming-and-diving/roster',
  'North Carolina': 'https://goheels.com/sports/mens-swimming-and-diving/roster',
  'Tennessee': 'https://utsports.com/sports/mens-swimming-and-diving/roster',
  'Purdue': 'https://purduesports.com/sports/mens-swimming-and-diving/roster',
  'South Carolina': 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster',
};

async function rescrapeTeam(browser, teamName, athleteNames) {
  const rosterUrl = TEAM_ROSTER_URLS[teamName];
  if (!rosterUrl) {
    console.log(`  ⚠️  No roster URL configured for ${teamName}`);
    return 0;
  }

  const page = await browser.newPage();
  let updated = 0;

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${teamName} (${athleteNames.length} athletes)`);
    console.log('='.repeat(60));

    await page.goto(rosterUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    for (const athleteName of athleteNames) {
      try {
        // Find athlete link on roster page
        const athleteLink = page.locator(`a:has-text("${athleteName}")`).first();

        if (await athleteLink.count() > 0) {
          const href = await athleteLink.getAttribute('href');
          if (!href) {
            console.log(`  ${athleteName}: No href found`);
            continue;
          }

          const fullUrl = href.startsWith('http') ? href : new URL(href, rosterUrl).href;

          // Navigate to athlete profile
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1500);

          // Try to find headshot
          const selectors = [
            'img.roster-bio-photo__image',
            'img.sidearm-roster-player-image',
            '.roster-photo img',
            '.player-photo img',
            'img[alt*="' + athleteName.split(' ')[0] + '"]',
            'img[alt*="' + athleteName.split(' ')[1] + '"]',
          ];

          let photoUrl = null;
          for (const selector of selectors) {
            const img = page.locator(selector).first();
            if (await img.count() > 0) {
              const src = await img.getAttribute('src');
              if (src && !src.includes('placeholder') && !src.includes('default') && !src.includes('person-default')) {
                photoUrl = src.startsWith('http') ? src : new URL(src, page.url()).href;

                // Upgrade to high quality if it has size parameters
                if (photoUrl.includes('width=') || photoUrl.includes('height=') || photoUrl.includes('resize')) {
                  photoUrl = photoUrl.replace(/width=\d+/, 'width=1200');
                  photoUrl = photoUrl.replace(/height=\d+/, 'height=1200');
                  photoUrl = photoUrl.replace(/w=\d+/, 'w=1200');
                  photoUrl = photoUrl.replace(/h=\d+/, 'h=1200');

                  if (!photoUrl.includes('width=') && photoUrl.includes('crop')) {
                    const separator = photoUrl.includes('?') ? '&' : '?';
                    photoUrl = `${photoUrl}${separator}width=1200&height=1200`;
                  }
                }

                break;
              }
            }
          }

          if (photoUrl) {
            // Update database
            await supabase
              .from('athletes')
              .update({ photo_url: photoUrl })
              .eq('name', athleteName);

            console.log(`  ✅ ${athleteName}`);
            updated++;
          } else {
            console.log(`  ⚠️  ${athleteName}: No photo found`);
          }

          // Go back to roster
          await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1000);

        } else {
          console.log(`  ⚠️  ${athleteName}: Not on roster page`);
        }
      } catch (error) {
        console.log(`  ❌ ${athleteName}: ${error.message}`);
      }
    }

  } catch (error) {
    console.log(`  ❌ Team error: ${error.message}`);
  } finally {
    await page.close();
  }

  return updated;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  console.log('Re-scraping teams with Supabase storage images...\n');

  // Get all athletes with Supabase images
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name');

  const teamMap = new Map(teams.map(t => [t.id, t.name]));

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, team_id, photo_url')
    .like('photo_url', '%supabase.co/storage%');

  // Group by team
  const athletesByTeam = {};
  athletes.forEach(a => {
    const teamName = teamMap.get(a.team_id);
    if (!athletesByTeam[teamName]) {
      athletesByTeam[teamName] = [];
    }
    athletesByTeam[teamName].push(a.name);
  });

  let totalUpdated = 0;
  let teamsProcessed = 0;

  // Process teams in order of most athletes
  const sortedTeams = Object.entries(athletesByTeam)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [teamName, athleteNames] of sortedTeams) {
    const updated = await rescrapeTeam(browser, teamName, athleteNames);
    totalUpdated += updated;
    teamsProcessed++;

    // Small delay between teams
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log('RESCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Teams processed: ${teamsProcessed}`);
  console.log(`Athletes updated: ${totalUpdated} out of ${athletes.length}`);
}

main();
