require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// School-specific configurations based on discovered URL patterns
const SCHOOL_CONFIGS = {
  'Notre Dame': {
    rosterUrl: 'https://fightingirish.com/sports/swim/roster',
    scrapeMethod: 'notreDame',
    note: 'Combined men/women roster - will show all athletes'
  },
  'Boston College': {
    rosterUrl: 'https://bceagles.com/sports/swimming-and-diving/roster',
    scrapeMethod: 'sidearmNew'
  },
  'NC State': {
    rosterUrl: 'https://gopack.com/sports/swimming-and-diving/roster',
    scrapeMethod: 'sidearmNew'
  },
  'Florida State': {
    rosterUrl: 'https://seminoles.com/sports/mens-swimming-and-diving/roster',
    scrapeMethod: 'sidearmNew'
  },
  'Louisville': {
    rosterUrl: 'https://gocards.com/sports/swimming-and-diving/roster',
    scrapeMethod: 'sidearmNew',
    note: 'Combined men/women roster - will show all athletes'
  },
  'Duke': {
    rosterUrl: 'https://goduke.com/sports/swimming-and-diving/roster',
    scrapeMethod: 'sidearmNew',
    note: 'Combined men/women roster - will show all athletes'
  },
  'Virginia Tech': {
    rosterUrl: 'https://hokiesports.com/sports/swimming-diving/roster',
    scrapeMethod: 'virginiaTech',
    note: 'Combined men/women roster - will show all athletes'
  },
  'Georgia Tech': {
    rosterUrl: 'https://ramblinwreck.com/sports/c-swim/roster',
    scrapeMethod: 'georgiaTech',
    note: 'Combined men/women roster - will show all athletes'
  }
};

async function scrapeRosterNames(page, url, method) {
  console.log(`  Loading: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    const names = await page.evaluate((method) => {
      const athleteNames = [];

      if (method === 'sidearmStandard') {
        // Standard SIDEARM roster structure
        const selectors = [
          '.sidearm-roster-player',
          '.sidearm-roster-player-container',
          'li.sidearm-roster-player'
        ];

        let athleteElements = [];
        for (const selector of selectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            athleteElements = elements;
            break;
          }
        }

        athleteElements.forEach(el => {
          const nameEl = el.querySelector('.sidearm-roster-player-name') ||
                         el.querySelector('[class*="name"]') ||
                         el.querySelector('h3') ||
                         el.querySelector('a');

          if (nameEl) {
            const name = nameEl.textContent.trim();
            if (name && name.length > 2 && !name.includes('Bio')) {
              athleteNames.push(name);
            }
          }
        });

      } else if (method === 'sidearmNew') {
        // New SIDEARM structure with data-test-id
        const seen = new Set();

        // Find all person card links
        const personLinks = Array.from(document.querySelectorAll('a[data-test-id*="person"][href*="/roster/"]'));

        personLinks.forEach(link => {
          const name = link.textContent.trim();

          // Filter out non-name content and duplicates
          if (name &&
              name.length > 2 &&
              !name.toLowerCase().includes('full bio') &&
              !name.toLowerCase().includes('profile') &&
              !name.toLowerCase().includes('roster') &&
              !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            athleteNames.push(name);
          }
        });

      } else if (method === 'notreDame') {
        // Notre Dame specific structure
        // Try to find roster links or name elements
        const links = Array.from(document.querySelectorAll('a[href*="/roster/"][href*="/player/"]'));
        const seen = new Set();

        links.forEach(link => {
          const name = link.textContent.trim();
          if (name &&
              name.length > 2 &&
              !name.toLowerCase().includes('bio') &&
              !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            athleteNames.push(name);
          }
        });

        // If no links found, try other selectors
        if (athleteNames.length === 0) {
          const cards = Array.from(document.querySelectorAll('[class*="roster"] [class*="card"], [class*="player-card"]'));
          cards.forEach(card => {
            const nameEl = card.querySelector('h3, h4, [class*="name"]');
            if (nameEl) {
              const name = nameEl.textContent.trim();
              if (name && name.length > 2 && !seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase());
                athleteNames.push(name);
              }
            }
          });
        }

      } else if (method === 'virginiaTech') {
        // Virginia Tech uses /roster/player/ links
        const links = Array.from(document.querySelectorAll('a[href*="/roster/player/"]'));
        const seen = new Set();

        links.forEach(link => {
          const name = link.textContent.trim();
          if (name &&
              name.length > 2 &&
              !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            athleteNames.push(name);
          }
        });

      } else if (method === 'georgiaTech') {
        // Georgia Tech uses table structure with names in first cell
        const table = document.querySelector('.roster__table, table');
        const seen = new Set();

        if (table) {
          const rows = Array.from(table.querySelectorAll('tr'));

          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));

            if (cells.length > 0) {
              const firstCell = cells[0];
              const name = firstCell.textContent.trim();

              // Filter out headers, subtitles, and non-names
              if (name &&
                  name.length > 2 &&
                  !name.toLowerCase().includes('name') &&
                  !name.toLowerCase().includes('roster') &&
                  !name.toLowerCase().includes('position') &&
                  name.split(' ').length >= 2 && // Has at least first + last name
                  !seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase());
                athleteNames.push(name);
              }
            }
          });
        }
      }

      return athleteNames;
    }, method);

    console.log(`  Found: ${names.length} athletes`);
    return names;

  } catch (error) {
    console.log(`  ❌ Error loading page: ${error.message}`);
    return [];
  }
}

async function verifyTeamRoster(teamName, config, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`VERIFYING: ${teamName}`);
  if (config.note) {
    console.log(`NOTE: ${config.note}`);
  }
  console.log('='.repeat(70));

  // Get team from database
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`❌ ${teamName} not found in database`);
    return { success: false, teamName };
  }

  // Get existing athletes
  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('name')
    .eq('team_id', team.id)
    .order('name');

  const dbNames = new Set(dbAthletes.map(a => a.name.toLowerCase().trim()));
  console.log(`Database: ${dbAthletes.length} athletes`);

  // Scrape roster page
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const scrapedNames = await scrapeRosterNames(page, config.rosterUrl, config.scrapeMethod);

  await context.close();

  if (scrapedNames.length === 0) {
    console.log('\n⚠️  WARNING: Could not scrape any athletes from roster page');
    console.log('   This may indicate the page structure has changed or the scraper needs adjustment');
    return { success: false, teamName, error: 'No athletes scraped' };
  }

  // Find missing athletes (on roster page but not in database)
  const missing = [];
  scrapedNames.forEach(name => {
    if (!dbNames.has(name.toLowerCase().trim())) {
      missing.push(name);
    }
  });

  // Find extra athletes (in database but not on roster page)
  const scrapedSet = new Set(scrapedNames.map(n => n.toLowerCase().trim()));
  const extra = [];
  dbAthletes.forEach(athlete => {
    if (!scrapedSet.has(athlete.name.toLowerCase().trim())) {
      extra.push(athlete.name);
    }
  });

  console.log(`\nRoster page: ${scrapedNames.length} athletes`);

  if (missing.length > 0) {
    console.log(`\n⚠️  MISSING FROM DATABASE (${missing.length}):`);
    missing.slice(0, 10).forEach(name => console.log(`  - ${name}`));
    if (missing.length > 10) {
      console.log(`  ... and ${missing.length - 10} more`);
    }
  }

  if (extra.length > 0) {
    console.log(`\n⚠️  IN DATABASE BUT NOT ON ROSTER PAGE (${extra.length}):`);
    extra.forEach(name => console.log(`  - ${name}`));
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(`\n✅ Perfect match - all roster athletes are in database`);
  }

  return {
    success: true,
    teamName,
    dbCount: dbAthletes.length,
    scrapedCount: scrapedNames.length,
    missingCount: missing.length,
    extraCount: extra.length,
    missing,
    extra
  };
}

async function main() {
  console.log('\n=== VERIFY COMPLETE ACC MEN\'S ROSTERS ===');
  console.log('Checking if database has all athletes from roster pages\n');

  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const [teamName, config] of Object.entries(SCHOOL_CONFIGS)) {
    try {
      results[teamName] = await verifyTeamRoster(teamName, config, browser);
    } catch (error) {
      console.log(`\n❌ ERROR: ${teamName}: ${error.message}`);
      results[teamName] = { success: false, teamName, error: error.message };
    }
  }

  await browser.close();

  // Final summary
  console.log('\n\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  let totalMissing = 0;
  let totalExtra = 0;
  let successCount = 0;
  let failCount = 0;

  for (const [teamName, result] of Object.entries(results)) {
    if (result.success) {
      successCount++;
      const status = result.missingCount === 0 && result.extraCount === 0 ? '✅' : '⚠️';
      console.log(`${status} ${teamName}: DB=${result.dbCount}, Roster=${result.scrapedCount}, Missing=${result.missingCount}, Extra=${result.extraCount}`);
      totalMissing += result.missingCount || 0;
      totalExtra += result.extraCount || 0;
    } else {
      failCount++;
      console.log(`❌ ${teamName}: FAILED - ${result.error || 'Unknown error'}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Successfully verified: ${successCount}/8 teams`);
  console.log(`Failed to scrape: ${failCount}/8 teams`);
  console.log(`Total missing from database: ${totalMissing} athletes`);
  console.log(`Total in DB but not on roster: ${totalExtra} athletes`);

  if (totalMissing > 0) {
    console.log('\n⚠️  ACTION NEEDED: Athletes found on roster pages but not in database');
  } else if (successCount === 8) {
    console.log('\n✅ All successfully scraped teams have complete rosters in database');
  }

  console.log('\n');
}

main();
