require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEAMS = {
  'Navy': {
    baseUrl: 'https://navysports.com/sports/mens-swimming-and-diving/roster'
  },
  'Harvard': {
    baseUrl: 'https://gocrimson.com/sports/mens-swimming-and-diving/roster'
  },
  'Cornell': {
    baseUrl: 'https://cornellbigred.com/sports/mens-swimming-and-diving/roster'
  },
  'Penn': {
    baseUrl: 'https://pennathletics.com/sports/mens-swimming-and-diving/roster'
  },
  'Towson': {
    baseUrl: 'https://towsontigers.com/sports/mens-swimming-and-diving/roster'
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
    // Listen for image responses
    const imgResponsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        return (url.includes('sidearmdev') || url.includes('cloudfront') || 
                url.includes('images/') || url.includes('sidearm') ||
                url.includes('gocrimson') || url.includes('navysports') ||
                url.includes('cornellbigred') || url.includes('pennathletics') ||
                url.includes('towsontigers')) &&
               response.status() === 200 &&
               !url.includes('logo') &&
               !url.includes('placeholder') &&
               !url.includes('icon');
      },
      { timeout: 15000 }
    ).catch(() => null);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      const img = document.querySelector('img.roster-bio-photo__image') ||
                   document.querySelector('.sidearm-roster-player-image') ||
                   document.querySelector('[class*="roster"] img') ||
                   document.querySelector('[class*="player"] img');
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
        '.player-image img',
        'img[src*="sidearm"]',
        'img[src*="gocrimson"]',
        'img[src*="navysports"]',
        'img[src*="cornellbigred"]',
        'img[src*="pennathletics"]',
        'img[src*="towsontigers"]'
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src &&
            !img.src.startsWith('data:image') &&
            !img.src.includes('dummy') &&
            !img.src.includes('placeholder') &&
            !img.src.includes('icon') &&
            !img.src.includes('logo')) {
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

async function scrapeTeam(teamName, teamData, browser) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${teamName}`);
  console.log('='.repeat(60));

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Get team ID
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .maybeSingle();

  if (!team) {
    console.log(`❌ Team not found: ${teamName}`);
    await context.close();
    return;
  }

  // Get athletes without photos
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
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
  
  return { updated, failed };
}

async function scrapeAllTeams() {
  console.log('Scraping Navy, Harvard, Cornell, Penn, and Towson for Headshots...\n');

  const browser = await chromium.launch({ headless: true });

  let totalUpdated = 0;
  let totalFailed = 0;

  for (const [teamName, teamData] of Object.entries(TEAMS)) {
    const result = await scrapeTeam(teamName, teamData, browser);
    totalUpdated += result.updated;
    totalFailed += result.failed;
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ All teams processed!');
  console.log('='.repeat(60));
  console.log(`Total photos added: ${totalUpdated}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log('='.repeat(60));
}

scrapeAllTeams().catch(console.error);
