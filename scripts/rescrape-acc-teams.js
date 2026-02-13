require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ACC_TEAMS = {
  'Cal': {
    id: 'f9deceb5-42db-46e8-aab1-6b8dab2bfd0c',
    baseUrl: 'https://calbears.com/sports/mens-swimming-and-diving/roster'
  },
  'SMU': {
    id: '35f0b011-8eb5-41f4-b711-3952aa96d941',
    baseUrl: 'https://smumustangs.com/sports/mens-swimming-and-diving/roster'
  },
  'Stanford': {
    id: '0f1717e7-7b79-4566-be44-fb106b8b2409',
    baseUrl: 'https://gostanford.com/sports/mens-swimming-and-diving/roster'
  }
};

function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeAthletePhoto(page, baseUrl, slug, teamName) {
  const url = `${baseUrl}/${slug}`;

  try {
    // Listen for image responses (Sidearm platform)
    const imgResponsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        return (url.includes('sidearmdev') || url.includes('cloudfront') || url.includes('images/')) &&
               response.status() === 200 &&
               !url.includes('logo') &&
               !url.includes('pepsi');
      },
      { timeout: 15000 }
    ).catch(() => null);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      const img = document.querySelector('img.roster-bio-photo__image') ||
                   document.querySelector('.sidearm-roster-player-image') ||
                   document.querySelector('[class*="roster"] img');
      if (img) {
        img.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });

    await page.waitForTimeout(2000);

    // Try DOM first
    const result = await page.evaluate(() => {
      const selectors = [
        'img.roster-bio-photo__image',
        'img.sidearm-roster-player-image',
        'img[src*="sidearmdev"]',
        'img[src*="cloudfront"]',
        '.roster-photo img',
        '.player-image img'
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src &&
            !img.src.startsWith('data:image') &&
            !img.src.includes('dummy') &&
            !img.src.includes('placeholder') &&
            !img.src.includes('pepsi')) {
          return { found: true, src: img.src };
        }
      }
      return { found: false };
    });

    if (result.found) {
      console.log(`  ✓ Found: ${result.src.substring(0, 80)}...`);
      return result.src;
    }

    // Fallback to network response
    const imgResponse = await imgResponsePromise;
    if (imgResponse) {
      const photoUrl = imgResponse.url();
      console.log(`  ✓ Network: ${photoUrl.substring(0, 80)}...`);
      return photoUrl;
    }

    console.log(`  ✗ No photo`);
    return null;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return null;
  }
}

async function rescrapeTeam(teamName, teamData, browser) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${teamName}`);
  console.log('='.repeat(60));

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Get athletes without photos
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', teamData.id)
    .order('name');

  console.log(`Total athletes: ${athletes.length}`);
  const needPhotos = athletes.filter(a => !a.photo_url);
  console.log(`Need photos: ${needPhotos.length}\n`);

  let updated = 0;
  let failed = 0;

  for (const athlete of needPhotos) {
    console.log(`${athlete.name}...`);
    const slug = createSlug(athlete.name);
    const photoUrl = await scrapeAthletePhoto(page, teamData.baseUrl, slug, teamName);

    if (photoUrl) {
      const { error } = await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);

      if (!error) {
        updated++;
      } else {
        console.log(`  ❌ DB error: ${error.message}`);
        failed++;
      }
    } else {
      failed++;
    }

    await page.waitForTimeout(1000);
  }

  await context.close();

  console.log(`\n📊 ${teamName} Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total processed: ${needPhotos.length}`);
}

async function rescrapeAllACCTeams() {
  console.log('Rescraping ACC Teams for Headshots...\n');

  const browser = await chromium.launch({ headless: true });

  for (const [teamName, teamData] of Object.entries(ACC_TEAMS)) {
    await rescrapeTeam(teamName, teamData, browser);
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ All ACC teams processed!');
  console.log('='.repeat(60));
}

rescrapeAllACCTeams().catch(console.error);
