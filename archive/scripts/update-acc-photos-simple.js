require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TEAMS_TO_UPDATE = [
  'Notre Dame',
  'Boston College',
  'NC State',
  'Florida State',
  'Louisville',
  'Duke',
  'Virginia Tech',
  'Georgia Tech'
];

const ROSTER_URLS = {
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

async function updateTeamPhotos(teamName, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`UPDATING: ${teamName}`);
  console.log('='.repeat(70));

  // Get team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`❌ Team not found`);
    return { success: false };
  }

  // Get athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} athletes in database\n`);

  const baseUrl = ROSTER_URLS[teamName];
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  let updated = 0;
  let failed = 0;

  for (const athlete of athletes) {
    const slug = createSlug(athlete.name);
    const profileUrl = `${baseUrl}/${slug}`;

    console.log(`${athlete.name}`);

    try {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2500);

      const photoUrl = await page.evaluate(() => {
        const selectors = [
          'img.sidearm-roster-player-image',
          'img.roster-bio-photo__image',
          'img[src*="imgproxy"]',
          'img[src*="sidearmdev"]',
          'img[src*="cloudfront"]',
          'img[src*="storage.googleapis"]',
          '.bio-photo img',
          '.player-image img'
        ];

        for (const selector of selectors) {
          const img = document.querySelector(selector);
          if (img && img.src &&
              !img.src.includes('logo') &&
              !img.src.includes('placeholder') &&
              !img.src.startsWith('data:image')) {
            return img.src;
          }
        }
        return null;
      });

      if (photoUrl && photoUrl !== athlete.photo_url) {
        await supabase
          .from('athletes')
          .update({ photo_url: photoUrl })
          .eq('id', athlete.id);

        console.log(`  ✅ Updated: ${photoUrl.substring(0, 70)}...`);
        updated++;
      } else if (photoUrl) {
        console.log(`  ⏭  Already current`);
      } else {
        console.log(`  ❌ No photo found`);
        failed++;
      }

      await page.waitForTimeout(500);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message.substring(0, 50)}`);
      failed++;
    }
  }

  await context.close();

  console.log(`\n${teamName}: Updated ${updated}/${athletes.length}, Failed ${failed}`);
  return { success: true, updated, failed, total: athletes.length };
}

async function main() {
  console.log('\n=== ACC PHOTO UPDATE ===\n');

  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const teamName of TEAMS_TO_UPDATE) {
    try {
      results[teamName] = await updateTeamPhotos(teamName, browser);
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
      console.log(`✅ ${teamName}: ${result.updated} updated, ${result.failed} failed`);
    } else {
      console.log(`❌ ${teamName}: FAILED`);
    }
  }
}

main();
