require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const athletesToScrape = [
  { name: 'Warner Russ', slug: 'warner-russ' },
  { name: 'Rokas Jazdauskas', slug: 'rokas-jazdauskas' },
  { name: 'Bradford Johnson', slug: 'bradford-johnson' },
  { name: 'Abdalla Nasr', slug: 'abdalla-nasr' },
];

async function scrapeAuburnAthletes() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Re-scraping Auburn athletes for real headshots...\n');

  let updated = 0;

  for (const athlete of athletesToScrape) {
    const url = `https://auburntigers.com/sports/swimming-diving/roster/player/${athlete.slug}`;

    try {
      console.log(`${athlete.name}...`);

      // Listen for imgproxy image requests
      const imgProxyPromise = page.waitForResponse(
        response => response.url().includes('imgproxy') && response.status() === 200 && !response.url().includes('sqv9TRq4rE'),
        { timeout: 15000 }
      ).catch(() => null);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Get the image URL from network response
      const imgResponse = await imgProxyPromise;

      if (imgResponse) {
        const photoUrl = imgResponse.url();

        // Update database
        await supabase
          .from('athletes')
          .update({ photo_url: photoUrl })
          .eq('name', athlete.name);

        console.log(`  ✅ Found real headshot`);
        updated++;
      } else {
        console.log(`  ⚠️  No real headshot found, keeping team logo`);
      }

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    await page.waitForTimeout(1000);
  }

  await browser.close();

  console.log(`\n✅ Updated ${updated} out of ${athletesToScrape.length} Auburn athletes with real headshots`);
}

scrapeAuburnAthletes();
