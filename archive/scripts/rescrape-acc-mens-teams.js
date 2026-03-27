require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ACC_TEAMS = {
  'Notre Dame': 'https://fightingirish.com/sports/mens-swimming-and-diving/roster',
  'Boston College': 'https://bceagles.com/sports/mens-swimming-and-diving/roster',
  'NC State': 'https://gopack.com/sports/mens-swimming-and-diving/roster',
  'Florida State': 'https://seminoles.com/sports/mens-swimming-and-diving/roster',
  'Louisville': 'https://gocards.com/sports/mens-swimming-and-diving/roster',
  'Duke': 'https://goduke.com/sports/mens-swimming-and-diving/roster',
  'Virginia Tech': 'https://hokiesports.com/sports/mens-swimming-and-diving/roster',
  'Georgia Tech': 'https://ramblinwreck.com/sports/mens-swimming-and-diving/roster'
};

function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeRosterPage(page, rosterUrl) {
  console.log(`  Loading roster page: ${rosterUrl}`);

  await page.goto(rosterUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Scroll to trigger lazy loading
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(2000);

  // Scrape all athletes from roster
  const athletes = await page.evaluate(() => {
    const athleteData = [];

    // SIDEARM patterns for roster listings
    const selectors = [
      '.sidearm-roster-player',
      '.sidearm-roster-player-container',
      '[class*="roster"] [class*="player"]',
      '.roster-card',
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
      // Get name
      const nameEl = el.querySelector('.sidearm-roster-player-name') ||
                     el.querySelector('[class*="name"]') ||
                     el.querySelector('h3') ||
                     el.querySelector('a');

      if (!nameEl) return;

      const name = nameEl.textContent.trim();
      if (!name || name.length < 2) return;

      // Get class year
      const classYearEl = el.querySelector('.sidearm-roster-player-academic-year') ||
                          el.querySelector('[class*="year"]');
      let classYear = classYearEl ? classYearEl.textContent.trim().toLowerCase() : 'unknown';

      // Normalize class year
      if (classYear.includes('fr') || classYear.includes('freshman')) classYear = 'freshman';
      else if (classYear.includes('so') || classYear.includes('sophomore')) classYear = 'sophomore';
      else if (classYear.includes('jr') || classYear.includes('junior')) classYear = 'junior';
      else if (classYear.includes('sr') || classYear.includes('senior')) classYear = 'senior';
      else if (classYear.includes('gr') || classYear.includes('graduate')) classYear = 'graduate';
      else classYear = 'unknown';

      // Get hometown
      const hometownEl = el.querySelector('.sidearm-roster-player-hometown') ||
                         el.querySelector('[class*="hometown"]');
      const hometown = hometownEl ? hometownEl.textContent.trim() : null;

      // Get profile URL
      const linkEl = el.querySelector('a[href*="/roster/"]');
      const profileUrl = linkEl ? linkEl.href : null;

      athleteData.push({
        name,
        classYear,
        hometown,
        profileUrl
      });
    });

    return athleteData;
  });

  console.log(`  Found ${athletes.length} athletes on roster page`);
  return athletes;
}

async function scrapeAthletePhoto(page, profileUrl) {
  if (!profileUrl) return null;

  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      const selectors = [
        'img.sidearm-roster-player-image',
        'img[src*="imgproxy"]',
        'img[src*="sidearmdev"]',
        'img[src*="cloudfront"]',
        'img[src*="storage.googleapis"]',
        '.roster-photo img',
        '.player-image img',
        '.bio-photo img'
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src &&
            !img.src.includes('logo') &&
            !img.src.includes('placeholder') &&
            !img.src.startsWith('data:image') &&
            !img.src.includes('pepsi')) {
          return img.src;
        }
      }
      return null;
    });

    return photoUrl;
  } catch (error) {
    console.log(`    Error loading profile: ${error.message}`);
    return null;
  }
}

async function scrapeTeam(teamName, rosterUrl, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SCRAPING: ${teamName}`);
  console.log('='.repeat(70));

  // Get team from database
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`❌ ${teamName} not found in database`);
    return { success: false };
  }

  console.log(`✓ Found team in database: ${team.id}\n`);

  // Get existing athletes
  const { data: existingAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, class_year')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Current database: ${existingAthletes?.length || 0} athletes\n`);

  // Scrape roster page
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const scrapedAthletes = await scrapeRosterPage(page, rosterUrl);

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const athlete of scrapedAthletes) {
    console.log(`\nProcessing: ${athlete.name}`);
    console.log(`  Class: ${athlete.classYear}, Hometown: ${athlete.hometown || 'N/A'}`);

    // Check if athlete exists
    const existing = existingAthletes?.find(a =>
      a.name.toLowerCase() === athlete.name.toLowerCase()
    );

    // Scrape photo
    let photoUrl = null;
    if (athlete.profileUrl) {
      console.log(`  Fetching photo from profile...`);
      photoUrl = await scrapeAthletePhoto(page, athlete.profileUrl);
      if (photoUrl) {
        console.log(`  ✓ Photo: ${photoUrl.substring(0, 70)}...`);
      } else {
        console.log(`  ✗ No photo found`);
      }
      await page.waitForTimeout(500);
    }

    if (existing) {
      // Update existing athlete
      const updates = {};
      if (photoUrl && photoUrl !== existing.photo_url) {
        updates.photo_url = photoUrl;
      }
      if (athlete.classYear !== 'unknown' && athlete.classYear !== existing.class_year) {
        updates.class_year = athlete.classYear;
      }
      if (athlete.hometown) {
        updates.hometown = athlete.hometown;
      }
      if (athlete.profileUrl) {
        updates.profile_url = athlete.profileUrl;
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('athletes')
          .update(updates)
          .eq('id', existing.id);
        console.log(`  ✅ Updated existing athlete`);
        updated++;
      } else {
        console.log(`  ⏭  No changes needed`);
        skipped++;
      }
    } else {
      // Add new athlete
      const newAthlete = {
        team_id: team.id,
        name: athlete.name,
        class_year: athlete.classYear === 'unknown' ? null : athlete.classYear,
        hometown: athlete.hometown,
        profile_url: athlete.profileUrl,
        photo_url: photoUrl,
        athlete_type: 'swimmer' // Default, can be updated manually if needed
      };

      const { error } = await supabase
        .from('athletes')
        .insert([newAthlete]);

      if (error) {
        console.log(`  ❌ Error adding: ${error.message}`);
      } else {
        console.log(`  ✅ Added new athlete`);
        added++;
      }
    }
  }

  await context.close();

  console.log(`\n=== ${teamName} RESULTS ===`);
  console.log(`Scraped from roster: ${scrapedAthletes.length}`);
  console.log(`Added: ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no changes): ${skipped}`);

  return { success: true, added, updated, skipped, total: scrapedAthletes.length };
}

async function main() {
  console.log('\n=== ACC MEN\'S SWIMMING & DIVING RESCRAPE ===\n');
  console.log('Teams to scrape:');
  Object.keys(ACC_TEAMS).forEach(team => console.log(`  - ${team}`));
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const [teamName, rosterUrl] of Object.entries(ACC_TEAMS)) {
    try {
      const result = await scrapeTeam(teamName, rosterUrl, browser);
      results[teamName] = result;
    } catch (error) {
      console.log(`\n❌ ERROR scraping ${teamName}: ${error.message}\n`);
      results[teamName] = { success: false, error: error.message };
    }
  }

  await browser.close();

  console.log('\n\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));

  for (const [teamName, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`\n✅ ${teamName}:`);
      console.log(`   Total scraped: ${result.total}`);
      console.log(`   Added: ${result.added}`);
      console.log(`   Updated: ${result.updated}`);
      console.log(`   Skipped: ${result.skipped}`);
    } else {
      console.log(`\n❌ ${teamName}: FAILED`);
      if (result.error) console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Rescrape complete!\n');
}

main();
