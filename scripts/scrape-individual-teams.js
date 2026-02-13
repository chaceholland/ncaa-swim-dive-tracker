require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Team-specific configurations with custom scraping logic
const teamConfigs = {
  Alabama: {
    name: 'Alabama',
    rosterUrl: 'https://rolltide.com/sports/swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
    scrapeLogic: async (page) => {
      // Alabama has combined roster, need to filter by gender or section
      const athletes = await page.evaluate(() => {
        const links = [];
        const allLinks = document.querySelectorAll('a[href*="/roster/"]');

        allLinks.forEach(link => {
          const href = link.href;
          const name = link.textContent.trim();

          if (name &&
              name.length > 2 &&
              name.length < 50 &&
              !name.includes('Full Bio') &&
              !href.includes('/coaches/') &&
              !href.includes('/staff/') &&
              href.includes('/swimming-and-diving/roster/')) {
            links.push({ name, url: href });
          }
        });

        // Remove duplicates
        const unique = [];
        const seen = new Set();
        links.forEach(a => {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            unique.push(a);
          }
        });

        return unique;
      });

      return athletes;
    },
  },

  Auburn: {
    name: 'Auburn',
    rosterUrl: 'https://auburntigers.com/sports/mens-swimming-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
    scrapeLogic: async (page) => {
      const athletes = await page.evaluate(() => {
        const links = [];
        const allLinks = document.querySelectorAll('a[href*="/roster/"]');

        allLinks.forEach(link => {
          const href = link.href;
          const name = link.textContent.trim();

          if (name &&
              name.length > 2 &&
              name.length < 50 &&
              !name.includes('Full Bio') &&
              !href.includes('/coaches/') &&
              !href.includes('/staff/') &&
              href.includes('/mens-swimming-diving/roster/')) {
            links.push({ name, url: href });
          }
        });

        const unique = [];
        const seen = new Set();
        links.forEach(a => {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            unique.push(a);
          }
        });

        return unique;
      });

      return athletes;
    },
  },

  Kentucky: {
    name: 'Kentucky',
    rosterUrl: 'https://ukathletics.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
    scrapeLogic: async (page) => {
      const athletes = await page.evaluate(() => {
        const links = [];
        const allLinks = document.querySelectorAll('a[href*="/roster/"]');

        allLinks.forEach(link => {
          const href = link.href;
          const name = link.textContent.trim();

          if (name &&
              name.length > 2 &&
              name.length < 50 &&
              !name.includes('Full Bio') &&
              !href.includes('/coaches/') &&
              !href.includes('/staff/') &&
              href.includes('/mens-swimming-and-diving/roster/')) {
            links.push({ name, url: href });
          }
        });

        const unique = [];
        const seen = new Set();
        links.forEach(a => {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            unique.push(a);
          }
        });

        return unique;
      });

      return athletes;
    },
  },

  LSU: {
    name: 'LSU',
    rosterUrl: 'https://lsusports.net/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
    scrapeLogic: async (page) => {
      const athletes = await page.evaluate(() => {
        const links = [];
        const allLinks = document.querySelectorAll('a[href*="/roster/"]');

        allLinks.forEach(link => {
          const href = link.href;
          const name = link.textContent.trim();

          if (name &&
              name.length > 2 &&
              name.length < 50 &&
              !name.includes('Full Bio') &&
              !href.includes('/coaches/') &&
              !href.includes('/staff/') &&
              href.includes('/mens-swimming-and-diving/roster/')) {
            links.push({ name, url: href });
          }
        });

        const unique = [];
        const seen = new Set();
        links.forEach(a => {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            unique.push(a);
          }
        });

        return unique;
      });

      return athletes;
    },
  },

  Missouri: {
    name: 'Missouri',
    rosterUrl: 'https://mutigers.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
    scrapeLogic: async (page) => {
      const athletes = await page.evaluate(() => {
        const links = [];
        const allLinks = document.querySelectorAll('a[href*="/roster/"]');

        allLinks.forEach(link => {
          const href = link.href;
          const name = link.textContent.trim();

          if (name &&
              name.length > 2 &&
              name.length < 50 &&
              !name.includes('Full Bio') &&
              !href.includes('/coaches/') &&
              !href.includes('/staff/') &&
              href.includes('/mens-swimming-and-diving/roster/')) {
            links.push({ name, url: href });
          }
        });

        const unique = [];
        const seen = new Set();
        links.forEach(a => {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            unique.push(a);
          }
        });

        return unique;
      });

      return athletes;
    },
  },

  'South Carolina': {
    name: 'South Carolina',
    rosterUrl: 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
    scrapeLogic: async (page) => {
      const athletes = await page.evaluate(() => {
        const links = [];
        const allLinks = document.querySelectorAll('a[href*="/roster/"]');

        allLinks.forEach(link => {
          const href = link.href;
          const name = link.textContent.trim();

          if (name &&
              name.length > 2 &&
              name.length < 50 &&
              !name.includes('Full Bio') &&
              !href.includes('/coaches/') &&
              !href.includes('/staff/') &&
              href.includes('/mens-swimming-and-diving/roster/')) {
            links.push({ name, url: href });
          }
        });

        const unique = [];
        const seen = new Set();
        links.forEach(a => {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            unique.push(a);
          }
        });

        return unique;
      });

      return athletes;
    },
  },
};

async function scrapeAthletePhoto(page, athleteUrl) {
  try {
    // Listen for high-res image responses
    const imagePromise = page.waitForResponse(
      response => {
        const url = response.url();
        return (
          response.status() === 200 &&
          (url.includes('.jpg') || url.includes('.png') || url.includes('imgproxy')) &&
          !url.includes('logo') &&
          !url.includes('placeholder')
        );
      },
      { timeout: 10000 }
    ).catch(() => null);

    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Try to get photo from network response first
    const imgResponse = await imagePromise;
    if (imgResponse) {
      let photoUrl = imgResponse.url();

      // Upgrade to high quality
      if (photoUrl.includes('width=') || photoUrl.includes('height=')) {
        photoUrl = photoUrl.replace(/width=\d+/, 'width=1200');
        photoUrl = photoUrl.replace(/height=\d+/, 'height=1200');
      }

      return photoUrl;
    }

    // Fallback: Try to find photo in DOM
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
        if (img && img.src && !img.src.includes('placeholder') && !img.src.includes('default')) {
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
    console.log(`      Error scraping photo: ${error.message}`);
    return null;
  }
}

async function scrapeTeam(browser, teamConfig) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Processing: ${teamConfig.name}`);
  console.log('='.repeat(70));

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamConfig.name)
    .single();

  if (!team) {
    console.log(`⚠️  Team not found in database: ${teamConfig.name}`);
    return { processed: 0, added: 0, updated: 0 };
  }

  const page = await browser.newPage();
  let processed = 0;
  let added = 0;
  let updated = 0;

  try {
    await page.goto(teamConfig.rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Use team-specific scraping logic
    const athleteLinks = await teamConfig.scrapeLogic(page);

    console.log(`Found ${athleteLinks.length} athletes on roster\n`);

    for (const athleteLink of athleteLinks) {
      console.log(`  Processing: ${athleteLink.name}`);

      // Check if athlete exists
      const { data: existing } = await supabase
        .from('athletes')
        .select('id, photo_url')
        .eq('team_id', team.id)
        .eq('name', athleteLink.name)
        .single();

      // Scrape photo
      const photoUrl = await scrapeAthletePhoto(page, athleteLink.url);
      const finalPhotoUrl = photoUrl || team.logo_url;

      if (existing) {
        // Update existing
        await supabase
          .from('athletes')
          .update({
            photo_url: finalPhotoUrl,
            profile_url: athleteLink.url,
          })
          .eq('id', existing.id);

        updated++;
        console.log(`    ✅ Updated (${photoUrl ? 'headshot' : 'logo'})`);
      } else {
        // Add new
        await supabase
          .from('athletes')
          .insert({
            team_id: team.id,
            name: athleteLink.name,
            photo_url: finalPhotoUrl,
            profile_url: athleteLink.url,
            athlete_type: 'swimmer',
          });

        added++;
        console.log(`    ✅ Added (${photoUrl ? 'headshot' : 'logo'})`);
      }

      processed++;
      await page.waitForTimeout(800); // Respectful delay
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  } finally {
    await page.close();
  }

  console.log(`\n${teamConfig.name} Summary:`);
  console.log(`  Total processed: ${processed}`);
  console.log(`  Added: ${added}`);
  console.log(`  Updated: ${updated}`);

  return { processed, added, updated };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  console.log('\n🎯 INDIVIDUAL TEAM SCRAPING');
  console.log('Processing remaining teams with custom logic...\n');

  const teams = ['Alabama', 'Auburn', 'Kentucky', 'LSU', 'Missouri', 'South Carolina'];
  const results = {};

  for (const teamName of teams) {
    const teamConfig = teamConfigs[teamName];
    if (teamConfig) {
      results[teamName] = await scrapeTeam(browser, teamConfig);
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ INDIVIDUAL TEAM SCRAPING COMPLETE');
  console.log('='.repeat(70));

  let totalProcessed = 0;
  let totalAdded = 0;
  let totalUpdated = 0;

  Object.entries(results).forEach(([team, stats]) => {
    console.log(`${team}: ${stats.processed} processed (${stats.added} added, ${stats.updated} updated)`);
    totalProcessed += stats.processed;
    totalAdded += stats.added;
    totalUpdated += stats.updated;
  });

  console.log(`\nGrand Total: ${totalProcessed} athletes (${totalAdded} new, ${totalUpdated} updated)`);
}

main();
