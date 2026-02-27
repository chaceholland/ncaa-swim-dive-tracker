require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getMissingFloridaState() {
  console.log('\n=== FLORIDA STATE MISSING ATHLETES ===');
  console.log('(Men\'s-specific roster - these are likely actual missing men)\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Get Florida State athletes from database
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Florida State')
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('name')
    .eq('team_id', team.id);

  const dbNames = new Set(dbAthletes.map(a => a.name.toLowerCase().trim()));

  // Scrape roster page
  await page.goto('https://seminoles.com/sports/mens-swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded',
    timeout: 20000
  });
  await page.waitForTimeout(5000);

  const scrapedNames = await page.evaluate(() => {
    const athleteNames = [];
    const seen = new Set();

    // New SIDEARM structure with data-test-id
    const personLinks = Array.from(document.querySelectorAll('a[data-test-id*="person"][href*="/roster/"]'));

    personLinks.forEach(link => {
      const name = link.textContent.trim();

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

    return athleteNames;
  });

  await context.close();
  await browser.close();

  // Find missing athletes
  const missing = scrapedNames.filter(name => !dbNames.has(name.toLowerCase().trim()));

  console.log(`Total on roster page: ${scrapedNames.length}`);
  console.log(`Total in database: ${dbAthletes.length}`);
  console.log(`Missing from database: ${missing.length}\n`);

  if (missing.length > 0) {
    console.log('Missing athletes:');
    missing.forEach((name, i) => {
      console.log(`  ${i + 1}. ${name}`);
    });
  }

  // Show who IS in database
  console.log(`\nCurrently in database:`);
  dbAthletes.forEach((athlete, i) => {
    console.log(`  ${i + 1}. ${athlete.name}`);
  });
}

getMissingFloridaState();
