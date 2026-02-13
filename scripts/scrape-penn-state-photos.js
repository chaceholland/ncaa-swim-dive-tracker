require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to create slug from name
function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeAthletePhoto(page, slug) {
  const url = `https://gopsusports.com/sports/mens-swimming-and-diving/roster/${slug}`;

  try {
    // Listen for image requests (Penn State might use sidearm like USC)
    const imgResponsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        return (url.includes('sidearmdev') || url.includes('cloudfront') || url.includes('gopsusports')) &&
               (url.includes('.jpg') || url.includes('.png') || url.includes('/images/')) &&
               response.status() === 200;
      },
      { timeout: 15000 }
    ).catch(() => null);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      const img = document.querySelector('img.roster-bio-photo__image') ||
                   document.querySelector('img.sidearm-roster-player-image') ||
                   document.querySelector('.player-image img');
      if (img) {
        img.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });

    // Wait a bit for lazy loading
    await page.waitForTimeout(2000);

    // Try to get image URL from DOM first
    const result = await page.evaluate(() => {
      const selectors = [
        'img.roster-bio-photo__image',
        'img.sidearm-roster-player-image',
        '.player-image img',
        'img[src*="images"]',
        'img[src*="sidearmdev"]',
        'img[src*="cloudfront"]'
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src && !img.src.startsWith('data:image')) {
          return {
            found: true,
            src: img.src,
            selector: selector
          };
        }
      }

      return { found: false };
    });

    if (result.found) {
      console.log(`  ✓ Found image: ${result.src.substring(0, 80)}...`);
      return result.src;
    }

    // Fallback: check if we got an image response
    const imgResponse = await imgResponsePromise;
    if (imgResponse) {
      const photoUrl = imgResponse.url();
      console.log(`  ✓ Captured from network: ${photoUrl.substring(0, 80)}...`);
      return photoUrl;
    }

    console.log(`  ✗ No image found`);
    return null;
  } catch (error) {
    console.error(`Error scraping ${slug}: ${error.message}`);
    return null;
  }
}

async function scrapePennStatePhotos() {
  console.log('Starting Penn State photo scraping with Playwright...\n');

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Get Penn State team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Penn State')
    .single();

  if (!team) {
    console.error('Penn State team not found');
    await browser.close();
    return;
  }

  console.log(`Found team: ${team.name} (ID: ${team.id})\n`);

  // Get all athletes without photos
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('team_id', team.id)
    .is('photo_url', null)
    .order('name');

  console.log(`Found ${athletes.length} athletes without photos\n`);

  let updated = 0;
  let failed = 0;

  for (const athlete of athletes) {
    try {
      console.log(`Scraping: ${athlete.name}...`);

      const slug = createSlug(athlete.name);
      const photoUrl = await scrapeAthletePhoto(page, slug);

      if (!photoUrl) {
        console.log(`❌ No photo found: ${athlete.name}`);
        failed++;
        continue;
      }

      // Update the photo URL
      const { error: updateError } = await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);

      if (updateError) {
        console.error(`❌ Error updating ${athlete.name}: ${updateError.message}`);
        failed++;
      } else {
        console.log(`✅ Updated: ${athlete.name}`);
        updated++;
      }

      // Small delay to be polite
      await page.waitForTimeout(1000);

    } catch (error) {
      console.error(`❌ Failed: ${athlete.name} - ${error.message}`);
      failed++;
    }
  }

  await browser.close();

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${athletes.length}`);
}

scrapePennStatePhotos().catch(console.error);
