require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Team configurations with roster URLs and logo URLs
// NOTE: Some schools combine men's and women's rosters, need to filter by URL pattern
const teamConfigs = [
  {
    name: 'Georgia',
    rosterUrl: 'https://georgiadogs.com/sports/msd/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/257.png',
    rosterPathPattern: '/sports/msd/roster/', // Men's only
  },
  {
    name: 'Alabama',
    rosterUrl: 'https://rolltide.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
    rosterPathPattern: '/sports/mens-swimming-and-diving/roster/',
  },
  {
    name: 'Auburn',
    rosterUrl: 'https://auburntigers.com/sports/mens-swimming-diving/roster', // FIXED: men's only
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
    rosterPathPattern: '/sports/mens-swimming-diving/roster/',
  },
  {
    name: 'Florida',
    rosterUrl: 'https://floridagators.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
    rosterPathPattern: '/sports/mens-swimming-and-diving/roster/',
  },
  {
    name: 'Kentucky',
    rosterUrl: 'https://ukathletics.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
    rosterPathPattern: '/sports/mens-swimming-and-diving/roster/',
  },
  {
    name: 'LSU',
    rosterUrl: 'https://lsusports.net/sports/mens-swimming-and-diving/roster', // FIXED
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
    rosterPathPattern: '/sports/mens-swimming-and-diving/roster/',
  },
  {
    name: 'Missouri',
    rosterUrl: 'https://mutigers.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
    rosterPathPattern: '/sports/mens-swimming-and-diving/roster/',
  },
  {
    name: 'South Carolina',
    rosterUrl: 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
    rosterPathPattern: '/sports/mens-swimming-and-diving/roster/',
  },
  {
    name: 'Tennessee',
    rosterUrl: 'https://utsports.com/sports/mens-swimming-and-diving/roster',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
    rosterPathPattern: '/sports/mens-swimming-and-diving/roster/',
  },
];

async function scrapeAthleteDetails(page, athleteUrl, teamName, teamLogoUrl) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const details = await page.evaluate(() => {
      const data = {
        photoUrl: null,
        classYear: null,
        height: null,
        weight: null,
        hometown: null,
        highSchool: null,
      };

      // Try to find high-res photo
      const selectors = [
        'img.roster-bio-photo__image',
        'img.sidearm-roster-player-image',
        '.roster-photo img',
        'img[itemprop="image"]',
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src && !img.src.includes('placeholder') && !img.src.includes('default')) {
          let photoUrl = img.src;

          // Upgrade to high quality
          if (photoUrl.includes('width=') || photoUrl.includes('height=')) {
            photoUrl = photoUrl.replace(/width=\d+/, 'width=1200');
            photoUrl = photoUrl.replace(/height=\d+/, 'height=1200');
          }

          data.photoUrl = photoUrl;
          break;
        }
      }

      // Extract bio data
      const bioItems = document.querySelectorAll('.sidearm-roster-player-bio-item, .bio-row, .rp-detail');
      bioItems.forEach(item => {
        const label = item.querySelector('.sidearm-roster-player-bio-item-label, .bio-label, .rp-detail-label');
        const value = item.querySelector('.sidearm-roster-player-bio-item-value, .bio-value, .rp-detail-value');

        if (label && value) {
          const labelText = label.textContent.trim().toLowerCase();
          const valueText = value.textContent.trim();

          if (labelText.includes('class') || labelText.includes('year')) {
            data.classYear = valueText.toLowerCase();
          } else if (labelText.includes('height')) {
            data.height = valueText;
          } else if (labelText.includes('weight')) {
            data.weight = valueText;
          } else if (labelText.includes('hometown')) {
            data.hometown = valueText;
          } else if (labelText.includes('high school') || labelText.includes('school')) {
            data.highSchool = valueText;
          }
        }
      });

      return data;
    });

    return details;
  } catch (error) {
    console.log(`      Error scraping details: ${error.message}`);
    return { photoUrl: null };
  }
}

async function scrapeTeamRoster(browser, teamConfig) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Processing: ${teamConfig.name}`);
  console.log('='.repeat(70));

  // Get team ID and logo
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamConfig.name)
    .single();

  if (!team) {
    console.log(`⚠️  Team not found in database: ${teamConfig.name}`);
    return;
  }

  const page = await browser.newPage();
  let athletesProcessed = 0;
  let athletesAdded = 0;
  let athletesUpdated = 0;

  try {
    await page.goto(teamConfig.rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get all athlete links from roster
    const athleteLinks = await page.evaluate((rosterPattern) => {
      const links = document.querySelectorAll('a[href*="/roster/"]');
      const athletes = [];

      links.forEach(link => {
        const href = link.href;
        const name = link.textContent.trim();

        // Filter out coaches, staff, duplicate "Full Bio" links, and wrong gender
        if (name &&
            name.length > 2 &&
            name.length < 50 &&
            !name.includes('Full Bio') &&
            !href.includes('/coaches/') &&
            !href.includes('/staff/') &&
            !href.includes('/womens-') &&
            !href.includes('/wsd/') && // Women's swim & dive
            !href.endsWith('/roster/') &&
            !href.endsWith('/roster') &&
            href.includes(rosterPattern)) { // IMPORTANT: Must match the roster pattern
          athletes.push({ name, url: href });
        }
      });

      // Remove duplicates
      const unique = [];
      const seen = new Set();
      athletes.forEach(a => {
        if (!seen.has(a.url)) {
          seen.add(a.url);
          unique.push(a);
        }
      });

      return unique;
    }, teamConfig.rosterPathPattern);

    console.log(`Found ${athleteLinks.length} athletes on roster\n`);

    for (const athleteLink of athleteLinks) {
      console.log(`  Processing: ${athleteLink.name}`);

      // Check if athlete already exists
      const { data: existing } = await supabase
        .from('athletes')
        .select('id, photo_url, profile_url')
        .eq('team_id', team.id)
        .eq('name', athleteLink.name)
        .single();

      // Scrape athlete details
      const details = await scrapeAthleteDetails(page, athleteLink.url, teamConfig.name, team.logo_url);

      // Use team logo as fallback if no photo found
      const photoUrl = details.photoUrl || team.logo_url;

      if (existing) {
        // Update existing athlete
        const updateData = {
          photo_url: photoUrl,
          profile_url: athleteLink.url,
          class_year: details.classYear || existing.class_year,
          hometown: details.hometown || existing.hometown,
        };

        await supabase
          .from('athletes')
          .update(updateData)
          .eq('id', existing.id);

        athletesUpdated++;
        console.log(`    ✅ Updated (${details.photoUrl ? 'headshot' : 'logo'})`);
      } else {
        // Add new athlete
        const insertData = {
          team_id: team.id,
          name: athleteLink.name,
          photo_url: photoUrl,
          profile_url: athleteLink.url,
          athlete_type: 'swimmer', // default
        };

        if (details.classYear) insertData.class_year = details.classYear;
        if (details.hometown) insertData.hometown = details.hometown;

        await supabase
          .from('athletes')
          .insert(insertData);

        athletesAdded++;
        console.log(`    ✅ Added (${details.photoUrl ? 'headshot' : 'logo'})`);
      }

      athletesProcessed++;
      await page.waitForTimeout(500); // Respectful delay
    }

  } catch (error) {
    console.log(`❌ Error processing ${teamConfig.name}: ${error.message}`);
  } finally {
    await page.close();
  }

  console.log(`\n${teamConfig.name} Summary:`);
  console.log(`  Total processed: ${athletesProcessed}`);
  console.log(`  Added: ${athletesAdded}`);
  console.log(`  Updated: ${athletesUpdated}`);
}

async function removeCoachesAndStaff(teamName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Checking ${teamName} for coaches/staff to remove`);
  console.log('='.repeat(70));

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  // Known coaches/staff to remove
  const staffNames = ['Chris Colwill', 'Alex Burdon', 'Sean Hayes', 'Jack Wisniewski'];

  for (const name of staffNames) {
    const { data: athlete } = await supabase
      .from('athletes')
      .select('id')
      .eq('team_id', team.id)
      .eq('name', name)
      .single();

    if (athlete) {
      await supabase
        .from('athletes')
        .delete()
        .eq('id', athlete.id);

      console.log(`  ✅ Removed: ${name}`);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  console.log('\n🎯 COMPREHENSIVE TEAM RE-SCRAPE');
  console.log('This will:');
  console.log('  1. Add missing athletes');
  console.log('  2. Update photos to high-res (1200px)');
  console.log('  3. Add profile URLs for clickable cards');
  console.log('  4. Capture additional athlete data');
  console.log('  5. Use team logos as fallback for missing photos');
  console.log('  6. Remove coaches/staff from athlete lists\n');

  // First, fix Georgia by removing coaches/staff
  await removeCoachesAndStaff('Georgia');

  // Then scrape all configured teams
  for (const teamConfig of teamConfigs) {
    await scrapeTeamRoster(browser, teamConfig);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ COMPREHENSIVE RE-SCRAPE COMPLETE');
  console.log('='.repeat(70));
}

main();
