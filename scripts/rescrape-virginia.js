require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const VIRGINIA_CONFIG = {
  name: 'Virginia',
  baseUrl: 'https://virginiasports.com/sports/mens-swimming-and-diving/roster'
};

function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeVirginiaPhotos() {
  console.log('\n=== RESCRAPING VIRGINIA HEADSHOTS ===\n');

  // Get Virginia team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', VIRGINIA_CONFIG.name)
    .single();

  if (!team) {
    console.log('❌ Virginia team not found');
    return;
  }

  console.log(`✓ Found team: ${team.name} (${team.id})\n`);

  // Get all Virginia athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} athletes\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  let updated = 0;
  let failed = 0;

  for (const athlete of athletes) {
    const slug = createSlug(athlete.name);
    const profileUrl = `${VIRGINIA_CONFIG.baseUrl}/${slug}`;

    console.log(`Processing: ${athlete.name}`);
    console.log(`  URL: ${profileUrl}`);

    try {
      // Navigate to athlete profile
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Try to find photo URL
      const photoUrl = await page.evaluate(() => {
        // Virginia uses imgproxy - look for the imgproxy URLs
        const selectors = [
          'img.sidearm-roster-player-image',
          'img[src*="imgproxy"]',
          'img[src*="virginiasports"]',
          '.roster-photo img',
          '.player-image img',
          'img[src*="storage.googleapis.com"]'
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

      if (photoUrl) {
        console.log(`  ✅ Found: ${photoUrl.substring(0, 80)}...`);
        
        // Update athlete
        await supabase
          .from('athletes')
          .update({ photo_url: photoUrl })
          .eq('id', athlete.id);
        
        updated++;
      } else {
        console.log(`  ❌ No photo found`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      failed++;
    }

    // Small delay between requests
    await page.waitForTimeout(500);
  }

  await browser.close();

  console.log(`\n=== RESULTS ===`);
  console.log(`✅ Updated: ${updated}/${athletes.length}`);
  console.log(`❌ Failed: ${failed}/${athletes.length}`);
}

scrapeVirginiaPhotos();
