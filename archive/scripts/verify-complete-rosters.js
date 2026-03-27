require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ACC_TEAMS_CONFIG = {
  'Notre Dame': {
    url: 'https://fightingirish.com/sports/mens-swimming-and-diving/roster',
    selectors: 'standard'
  },
  'Boston College': {
    url: 'https://bceagles.com/sports/mens-swimming-and-diving/roster',
    selectors: 'standard'
  },
  'NC State': {
    url: 'https://gopack.com/sports/mens-swimming-and-diving/roster',
    selectors: 'standard'
  },
  'Florida State': {
    url: 'https://seminoles.com/sports/mens-swimming-and-diving/roster',
    selectors: 'standard'
  },
  'Louisville': {
    url: 'https://gocards.com/sports/swimming-and-diving/roster',
    selectors: 'new' // Uses data-test-id structure
  },
  'Duke': {
    url: 'https://goduke.com/sports/swimming-and-diving/roster',
    selectors: 'new' // Uses data-test-id structure
  },
  'Virginia Tech': {
    url: 'https://hokiesports.com/sports/mens-swimming-and-diving/roster',
    selectors: 'standard'
  },
  'Georgia Tech': {
    url: 'https://ramblinwreck.com/sports/mens-swimming-and-diving/roster',
    selectors: 'standard'
  }
};

async function scrapeRosterNames(page, url, selectorType) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(2000);

  const names = await page.evaluate((selectorType) => {
    const athleteNames = [];

    if (selectorType === 'standard') {
      // Standard SIDEARM selectors
      const selectors = [
        '.sidearm-roster-player',
        '.sidearm-roster-player-container',
        '[class*="roster"] [class*="player"]',
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
          if (name && name.length > 2) {
            athleteNames.push(name);
          }
        }
      });
    } else if (selectorType === 'new') {
      // New data-test-id structure
      const links = Array.from(document.querySelectorAll('a[data-test-id*="person"]'));
      const seen = new Set();

      links.forEach(link => {
        const name = link.textContent.trim();
        // Filter out duplicates, "Full Bio", and other non-name text
        if (name &&
            name.length > 2 &&
            !name.includes('Full Bio') &&
            !name.includes('profile page') &&
            !seen.has(name)) {
          seen.add(name);
          athleteNames.push(name);
        }
      });
    }

    return athleteNames;
  }, selectorType);

  return names;
}

async function verifyTeamRoster(teamName, config, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`VERIFYING: ${teamName}`);
  console.log('='.repeat(70));

  // Get team from database
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`❌ ${teamName} not found in database`);
    return { success: false };
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

  const scrapedNames = await scrapeRosterNames(page, config.url, config.selectors);

  await context.close();

  console.log(`Roster page: ${scrapedNames.length} athletes`);

  // Find missing athletes
  const missing = [];
  scrapedNames.forEach(name => {
    if (!dbNames.has(name.toLowerCase().trim())) {
      missing.push(name);
    }
  });

  if (missing.length > 0) {
    console.log(`\n⚠️  MISSING FROM DATABASE (${missing.length}):`);
    missing.forEach(name => console.log(`  - ${name}`));
  } else {
    console.log(`\n✅ All roster athletes are in database`);
  }

  return { success: true, total: scrapedNames.length, inDb: dbAthletes.length, missing: missing.length };
}

async function main() {
  console.log('\n=== VERIFY COMPLETE ACC ROSTERS ===\n');

  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const [teamName, config] of Object.entries(ACC_TEAMS_CONFIG)) {
    try {
      results[teamName] = await verifyTeamRoster(teamName, config, browser);
    } catch (error) {
      console.log(`\n❌ ERROR: ${teamName}: ${error.message}`);
      results[teamName] = { success: false, error: error.message };
    }
  }

  await browser.close();

  console.log('\n\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  for (const [teamName, result] of Object.entries(results)) {
    if (result.success) {
      if (result.missing === 0) {
        console.log(`✅ ${teamName}: Complete (${result.inDb} athletes)`);
      } else {
        console.log(`⚠️  ${teamName}: Missing ${result.missing} athletes (${result.inDb}/${result.total})`);
      }
    } else {
      console.log(`❌ ${teamName}: FAILED`);
    }
  }

  console.log('\n');
}

main();
