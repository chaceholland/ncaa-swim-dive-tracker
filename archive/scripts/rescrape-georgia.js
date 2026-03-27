require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const GEORGIA_URL = 'https://georgiadogs.com/sports/mens-swimming-and-diving/roster';

async function scrapeAthletePhoto(page, athleteUrl) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      const selectors = [
        'img.roster-bio-photo__image',
        'img.sidearm-roster-player-image',
        '.roster-photo img',
        'img[itemprop="image"]',
        'picture img',
        '.player-image img',
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src && !img.src.includes('placeholder') && !img.src.includes('default') && !img.src.includes('logo')) {
          let src = img.src;

          // Upgrade to high quality
          if (src.includes('width=') || src.includes('height=')) {
            src = src.replace(/width=\d+/, 'width=1200');
            src = src.replace(/height=\d+/, 'height=1200');
          }

          return src;
        }
      }

      return null;
    });

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function rescrapeGeorgia() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('\n🔄 RESCRAPING GEORGIA');
  console.log('='.repeat(70));

  // Get Georgia team
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Georgia')
    .single();

  if (!team) {
    console.log('⚠️  Georgia team not found');
    await browser.close();
    return;
  }

  // Get all Georgia athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} athletes in database\n`);

  try {
    await page.goto(GEORGIA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get all athlete links
    const rosterLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="/roster/"]').forEach(link => {
        const href = link.href;
        const name = link.textContent.trim();

        if (name &&
            name.length > 2 &&
            name.length < 50 &&
            !name.includes('Full Bio') &&
            !href.includes('/coaches/') &&
            !href.includes('/staff/')) {
          links.push({ name, url: href });
        }
      });

      // Remove duplicates
      const unique = [];
      const seen = new Set();
      links.forEach(l => {
        if (!seen.has(l.url)) {
          seen.add(l.url);
          unique.push(l);
        }
      });

      return unique;
    });

    console.log(`Found ${rosterLinks.length} athletes on roster page\n`);

    let updated = 0;
    let photosFound = 0;

    // For each athlete in our database, get their photo
    for (const athlete of athletes) {
      const match = rosterLinks.find(r => r.name === athlete.name);

      if (match) {
        console.log(`  Processing: ${athlete.name}`);

        // Scrape photo
        const photoUrl = await scrapeAthletePhoto(page, match.url);
        
        if (photoUrl) {
          await supabase
            .from('athletes')
            .update({
              profile_url: match.url,
              photo_url: photoUrl,
            })
            .eq('id', athlete.id);

          console.log(`    ✅ Updated with photo`);
          photosFound++;
          updated++;
        } else {
          await supabase
            .from('athletes')
            .update({
              profile_url: match.url,
            })
            .eq('id', athlete.id);

          console.log(`    ⚠️  No photo found, using team logo`);
          updated++;
        }
      } else {
        console.log(`  ⚠️  Not found on roster: ${athlete.name}`);
      }

      await page.waitForTimeout(500);
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ RESCRAPE COMPLETE');
    console.log('='.repeat(70));
    console.log(`Updated: ${updated}/${athletes.length} athletes`);
    console.log(`Photos found: ${photosFound}/${updated} athletes`);

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  } finally {
    await page.close();
    await browser.close();
  }
}

rescrapeGeorgia();
