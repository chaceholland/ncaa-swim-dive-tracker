require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const athletesToRescrape = [
  'Tim Korstanje',
  'Sean Niewold',
  'Mark Underwood',
  'Ethan Otten',
  'Cole Witmer',
  'Noah Saylor',
  'Aaron Gasiewicz',
  'Adam Varga',
  'Lance Johnson'
];

async function scrapeAlabamaRoster() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Scraping Alabama roster for high-quality headshots...\n');

  try {
    await page.goto('https://rolltide.com/sports/swimming-and-diving/roster', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    let updated = 0;

    for (const athleteName of athletesToRescrape) {
      console.log(`${athleteName}...`);

      // Try to find the athlete's link on the roster page
      const athleteLink = page.locator(`a:has-text("${athleteName}")`).first();

      if (await athleteLink.count() > 0) {
        const href = await athleteLink.getAttribute('href');
        const fullUrl = href.startsWith('http') ? href : `https://rolltide.com${href}`;

        // Navigate to athlete's profile page
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Try to find the headshot
        const selectors = [
          'img.roster-bio-photo__image',
          'img.sidearm-roster-player-image',
          '.roster-photo img',
          'img[alt*="' + athleteName.split(' ')[1] + '"]',
        ];

        let photoUrl = null;
        for (const selector of selectors) {
          const img = page.locator(selector).first();
          if (await img.count() > 0) {
            const src = await img.getAttribute('src');
            if (src && !src.includes('placeholder') && !src.includes('default')) {
              photoUrl = src.startsWith('http') ? src : new URL(src, page.url()).href;

              // Make sure it's high quality
              if (photoUrl.includes('width=') || photoUrl.includes('height=')) {
                photoUrl = photoUrl.replace(/width=\d+/, 'width=1200');
                photoUrl = photoUrl.replace(/height=\d+/, 'height=1200');

                if (!photoUrl.includes('width=')) {
                  photoUrl += photoUrl.includes('?') ? '&width=1200&height=1200' : '?width=1200&height=1200';
                }
              }

              break;
            }
          }
        }

        if (photoUrl) {
          // Update database
          const { data: athlete } = await supabase
            .from('athletes')
            .select('id')
            .eq('name', athleteName)
            .single();

          if (athlete) {
            await supabase
              .from('athletes')
              .update({ photo_url: photoUrl })
              .eq('id', athlete.id);

            console.log(`  ✅ Updated with high-quality headshot`);
            updated++;
          }
        } else {
          console.log(`  ⚠️  Could not find headshot`);
        }

        // Go back to roster page
        await page.goto('https://rolltide.com/sports/swimming-and-diving/roster', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } else {
        console.log(`  ⚠️  Not found on roster page`);
      }

      // Small delay between athletes
      await page.waitForTimeout(1000);
    }

    console.log(`\n✅ Updated ${updated} out of ${athletesToRescrape.length} Alabama athletes`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

scrapeAlabamaRoster();
