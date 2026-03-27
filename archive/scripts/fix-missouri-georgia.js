require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function upgradeTo1200(teamName, athleteNames) {
  console.log(`\nUpgrading ${teamName} 800px images to 1200px...`);

  for (const name of athleteNames) {
    const { data: athlete } = await supabase
      .from('athletes')
      .select('id, photo_url')
      .eq('name', name)
      .single();

    if (athlete && athlete.photo_url) {
      const newUrl = athlete.photo_url
        .replace(/width=800/, 'width=1200')
        .replace(/height=800/, 'height=1200');

      await supabase
        .from('athletes')
        .update({ photo_url: newUrl })
        .eq('id', athlete.id);

      console.log(`  ✅ ${name}: 800px → 1200px`);
    }
  }
}

async function rescrapeSupabaseImages(browser, teamName, rosterUrl) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Re-scraping ${teamName} Supabase images`);
  console.log('='.repeat(60));

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%supabase.co/storage%');

  if (athletes.length === 0) {
    console.log('No Supabase images found');
    return 0;
  }

  console.log(`Found ${athletes.length} athletes with Supabase images\n`);

  const page = await browser.newPage();
  let updated = 0;

  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    for (const athlete of athletes) {
      try {
        const athleteLink = page.locator(`a:has-text("${athlete.name}")`).first();

        if (await athleteLink.count() > 0) {
          const href = await athleteLink.getAttribute('href');
          const fullUrl = href.startsWith('http') ? href : new URL(href, rosterUrl).href;

          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1500);

          const selectors = [
            'img.roster-bio-photo__image',
            'img.sidearm-roster-player-image',
            '.roster-photo img',
            'img[alt*="' + athlete.name.split(' ')[1] + '"]',
          ];

          let photoUrl = null;
          for (const selector of selectors) {
            const img = page.locator(selector).first();
            if (await img.count() > 0) {
              const src = await img.getAttribute('src');
              if (src && !src.includes('placeholder') && !src.includes('default')) {
                photoUrl = src.startsWith('http') ? src : new URL(src, page.url()).href;

                // Upgrade to high quality
                if (photoUrl.includes('width=') || photoUrl.includes('height=')) {
                  photoUrl = photoUrl.replace(/width=\d+/, 'width=1200');
                  photoUrl = photoUrl.replace(/height=\d+/, 'height=1200');
                }

                break;
              }
            }
          }

          if (photoUrl) {
            await supabase
              .from('athletes')
              .update({ photo_url: photoUrl })
              .eq('id', athlete.id);

            console.log(`  ✅ ${athlete.name}`);
            updated++;
          } else {
            console.log(`  ⚠️  ${athlete.name}: No photo found`);
          }

          await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1000);
        } else {
          console.log(`  ⚠️  ${athlete.name}: Not on roster`);
        }
      } catch (error) {
        console.log(`  ❌ ${athlete.name}: ${error.message}`);
      }
    }
  } finally {
    await page.close();
  }

  return updated;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Upgrade 800px to 1200px
  await upgradeTo1200('Missouri', ['Andrew Grevers', 'Andrew Sansoucie', 'Kyle Bogner']);
  await upgradeTo1200('Georgia', ['Chris Colwill', 'Alex Burdon', 'Jack Wisniewski', 'Sean Hayes']);

  // Re-scrape Supabase images
  const missouriUpdated = await rescrapeSupabaseImages(
    browser,
    'Missouri',
    'https://mutigers.com/sports/mens-swimming-and-diving/roster'
  );

  const georgiaUpdated = await rescrapeSupabaseImages(
    browser,
    'Georgia',
    'https://georgiadogs.com/sports/mens-swimming-and-diving/roster'
  );

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log('COMPLETE');
  console.log('='.repeat(60));
  console.log(`Missouri: ${missouriUpdated} athletes re-scraped`);
  console.log(`Georgia: ${georgiaUpdated} athletes re-scraped`);
}

main();
