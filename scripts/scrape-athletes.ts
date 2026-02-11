import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TeamRosterUrl {
  teamName: string;
  url: string;
}

// Men's roster URLs for all 53 teams
const rosterUrls: TeamRosterUrl[] = [
  // SEC
  { teamName: 'Florida', url: 'https://floridagators.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Texas', url: 'https://texassports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Alabama', url: 'https://rolltide.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Auburn', url: 'https://auburntigers.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Georgia', url: 'https://georgiadogs.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Tennessee', url: 'https://utsports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Missouri', url: 'https://mutigers.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Kentucky', url: 'https://ukathletics.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'LSU', url: 'https://lsusports.net/sports/mens-swimming-and-diving/roster' },
  { teamName: 'South Carolina', url: 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Texas A&M', url: 'https://12thman.com/sports/mens-swimming-and-diving/roster' },

  // ACC
  { teamName: 'Virginia', url: 'https://virginiasports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'NC State', url: 'https://gopack.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Notre Dame', url: 'https://und.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Pittsburgh', url: 'https://pittsburghpanthers.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Louisville', url: 'https://gocards.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Virginia Tech', url: 'https://hokiesports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Florida State', url: 'https://seminoles.com/sports/swimming-diving-m/roster/' },
  { teamName: 'Duke', url: 'https://goduke.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'North Carolina', url: 'https://goheels.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Boston College', url: 'https://bceagles.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Georgia Tech', url: 'https://ramblinwreck.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Stanford', url: 'https://gostanford.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Cal', url: 'https://calbears.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'SMU', url: 'https://smumustangs.com/sports/mens-swimming-and-diving/roster' },

  // Big Ten
  { teamName: 'Indiana', url: 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/m-swim/roster/' },
  { teamName: 'Michigan', url: 'https://mgoblue.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Penn State', url: 'https://gopsusports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Northwestern', url: 'https://nusports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Minnesota', url: 'https://gophersports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Purdue', url: 'https://purduesports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Wisconsin', url: 'https://uwbadgers.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'USC', url: 'https://usctrojans.com/sports/mens-swimming-and-diving/roster' },

  // Big 12
  { teamName: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'West Virginia', url: 'https://wvusports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'TCU', url: 'https://gofrogs.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Utah', url: 'https://utahutes.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Arizona', url: 'https://arizonawildcats.com/sports/mens-swimming-and-diving/roster' },

  // Ivy League
  { teamName: 'Harvard', url: 'https://gocrimson.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Yale', url: 'https://yalebulldogs.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Princeton', url: 'https://goprincetontigers.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Columbia', url: 'https://gocolumbialions.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Penn', url: 'https://pennathletics.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Cornell', url: 'https://cornellbigred.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Brown', url: 'https://brownbears.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Dartmouth', url: 'https://dartmouthsports.com/sports/mens-swimming-and-diving/roster' },

  // Patriot League
  { teamName: 'Navy', url: 'https://navysports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Army', url: 'https://goarmywestpoint.com/sports/mens-swimming-and-diving/roster' },

  // Other (These teams may not have men's programs - will handle gracefully)
  { teamName: 'George Washington', url: 'https://gwsports.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Towson', url: 'https://towsontigers.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'Southern Illinois', url: 'https://siusalukis.com/sports/mens-swimming-and-diving/roster' },
  { teamName: 'UNLV', url: 'https://unlvrebels.com/sports/mens-swimming-and-diving/roster' },
];

async function scrapeTeamRoster(browser: any, teamName: string, url: string) {
  console.log(`\n🏊 Scraping ${teamName}...`);

  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for dynamic content

    // Try multiple selector patterns (different sites use different structures)
    const athletes = await page.evaluate(() => {
      const results: any[] = [];

      // Pattern 1: Sidearm Sports (most common)
      const sidearmRows = document.querySelectorAll('.sidearm-roster-player, .s-person-card');
      sidearmRows.forEach((row: any) => {
        const nameEl = row.querySelector('.sidearm-roster-player-name, .s-person-details__personal-single-line a, h3 a, .s-person-card__content h3');
        const classEl = row.querySelector('.sidearm-roster-player-academic-year, .s-person-details__bio-stats-item:first-child, .academic-year');
        const hometownEl = row.querySelector('.sidearm-roster-player-hometown, .s-person-details__bio-stats-item:last-child, .hometown');
        const positionEl = row.querySelector('.sidearm-roster-player-position, .position, [class*="position"]');
        const photoEl = row.querySelector('img');

        const name = nameEl?.textContent?.trim();
        if (name) {
          const classYear = classEl?.textContent?.trim()?.toLowerCase() || '';
          const hometown = hometownEl?.textContent?.trim() || '';
          const position = positionEl?.textContent?.trim()?.toLowerCase() || '';
          const photoUrl = photoEl?.src || '';

          // Map class year
          let mappedClass = '';
          if (classYear.includes('fr')) mappedClass = 'freshman';
          else if (classYear.includes('so')) mappedClass = 'sophomore';
          else if (classYear.includes('jr')) mappedClass = 'junior';
          else if (classYear.includes('sr') || classYear.includes('sr')) mappedClass = 'senior';

          // Determine if diver or swimmer
          let athleteType = 'swimmer';
          if (position.includes('div')) athleteType = 'diver';

          results.push({
            name,
            classYear: mappedClass,
            hometown,
            athleteType,
            photoUrl: photoUrl.startsWith('http') ? photoUrl : ''
          });
        }
      });

      // Pattern 2: Generic roster table
      if (results.length === 0) {
        const tableRows = document.querySelectorAll('table tbody tr, .roster-card, .athlete-card');
        tableRows.forEach((row: any) => {
          const cells = row.querySelectorAll('td, .card-content');
          const name = cells[0]?.textContent?.trim() || cells[0]?.querySelector('a')?.textContent?.trim();

          if (name && name.length > 2) {
            results.push({
              name,
              classYear: '',
              hometown: '',
              athleteType: 'swimmer',
              photoUrl: ''
            });
          }
        });
      }

      return results;
    });

    console.log(`  ✅ Found ${athletes.length} athletes`);

    if (athletes.length === 0) {
      console.log(`  ⚠️  No athletes found - may not have men's program or different site structure`);
      await page.close();
      return { success: false, count: 0 };
    }

    // Get team ID from database
    const { data: teamData } = await supabase
      .from('teams')
      .select('id')
      .eq('name', teamName)
      .single();

    if (!teamData) {
      console.log(`  ❌ Team not found in database: ${teamName}`);
      await page.close();
      return { success: false, count: 0 };
    }

    // Insert athletes
    let successCount = 0;
    for (const athlete of athletes) {
      const { error } = await supabase
        .from('athletes')
        .insert({
          name: athlete.name,
          team_id: teamData.id,
          photo_url: athlete.photoUrl || null,
          athlete_type: athlete.athleteType,
          class_year: athlete.classYear || null,
          hometown: athlete.hometown || null,
        });

      if (!error) {
        successCount++;
      }
    }

    console.log(`  💾 Inserted ${successCount}/${athletes.length} athletes into database`);
    await page.close();
    return { success: true, count: successCount };

  } catch (error) {
    console.log(`  ❌ Error scraping ${teamName}: ${(error as Error).message}`);
    await page.close();
    return { success: false, count: 0 };
  }
}

async function scrapeAllRosters() {
  console.log('🚀 Starting NCAA Men\'s Swimming & Diving Roster Scraper\n');
  console.log(`📊 Total teams to scrape: ${rosterUrls.length}\n`);

  const browser = await chromium.launch({ headless: true });

  let totalAthletes = 0;
  let successfulTeams = 0;
  let failedTeams = 0;

  for (const { teamName, url } of rosterUrls) {
    const result = await scrapeTeamRoster(browser, teamName, url);

    if (result.success) {
      totalAthletes += result.count;
      successfulTeams++;
    } else {
      failedTeams++;
    }

    // Rate limiting - wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log('📈 SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Successful teams: ${successfulTeams}`);
  console.log(`❌ Failed teams: ${failedTeams}`);
  console.log(`👤 Total athletes added: ${totalAthletes}`);
  console.log('='.repeat(60));
}

scrapeAllRosters()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
