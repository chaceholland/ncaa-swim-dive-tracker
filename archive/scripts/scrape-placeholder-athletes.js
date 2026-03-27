require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Athletes with dummy placeholders and their profile URLs
const athletesToScrape = [
  { name: 'Jack Neiman', team: 'Florida', teamId: null },
  { name: 'Joseph Frullaney', team: 'Army', teamId: null },
  { name: 'Chris Morgan', team: 'Boston College', teamId: null },
  { name: 'Patrick Hemingway', team: 'Ohio State', teamId: null },
  { name: 'Paul Kelley', team: 'Indiana', teamId: null },
  { name: 'Will Sowle', team: 'Indiana', teamId: null },
  { name: 'Aidan Siers', team: 'Florida State', teamId: null },
];

async function scrapeAthleteHeadshot(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Try various common selectors for athlete headshots
    const selectors = [
      'img.roster-bio-photo__image',
      'img.sidearm-roster-player-image',
      'img.player-image',
      '.athlete-bio-image img',
      '.player-bio img',
      'img[alt*="headshot"]',
      'img[alt*="photo"]',
    ];

    for (const selector of selectors) {
      const img = await page.locator(selector).first();
      if (await img.count() > 0) {
        const src = await img.getAttribute('src');
        if (src && !src.includes('person-default') && !src.includes('placeholder')) {
          // Make sure it's a full URL
          const fullUrl = src.startsWith('http') ? src : new URL(src, url).href;
          return fullUrl;
        }
      }
    }

    return null;
  } catch (error) {
    console.log(`  Error scraping: ${error.message}`);
    return null;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Scraping headshots for athletes with dummy placeholders...\n');

  let scraped = 0;
  let failed = 0;

  for (const athlete of athletesToScrape) {
    console.log(`${athlete.name} (${athlete.team})`);

    // Get athlete data from database
    const { data: athleteData } = await supabase
      .from('athletes')
      .select('id, profile_url, team_id')
      .eq('name', athlete.name)
      .single();

    if (!athleteData || !athleteData.profile_url) {
      console.log(`  ⚠️  No profile URL found`);
      failed++;
      continue;
    }

    // Try to scrape headshot
    const headshot = await scrapeAthleteHeadshot(page, athleteData.profile_url);

    if (headshot) {
      // Update database
      await supabase
        .from('athletes')
        .update({ photo_url: headshot })
        .eq('id', athleteData.id);

      console.log(`  ✅ Found headshot`);
      scraped++;
    } else {
      // Fall back to team logo
      const { data: team } = await supabase
        .from('teams')
        .select('logo_url')
        .eq('id', athleteData.team_id)
        .single();

      if (team && team.logo_url) {
        await supabase
          .from('athletes')
          .update({ photo_url: team.logo_url })
          .eq('id', athleteData.id);

        console.log(`  📋 Using team logo (no headshot found)`);
      } else {
        console.log(`  ❌ No headshot or logo available`);
      }
      failed++;
    }

    // Small delay between requests
    await page.waitForTimeout(1000);
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Headshots found: ${scraped}`);
  console.log(`Failed/using logo: ${failed}`);
}

main();
