require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Correct roster URLs discovered
const teamUrls = {
  'Auburn': 'https://auburntigers.com/sports/swimming-diving/roster',
  'Kentucky': 'https://ukathletics.com/sports/swimming/roster/',
  'LSU': 'https://lsusports.net/sports/sd/roster/',
  'Missouri': 'https://mutigers.com/sports/swimming-and-diving/roster',
  'South Carolina': 'https://gamecocksonline.com/sports/swimming/roster/',
};

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

async function updateTeamAthletes(browser, teamName, rosterUrl) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Processing: ${teamName}`);
  console.log('='.repeat(70));

  // Get team and its existing athletes from database
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`⚠️  Team not found: ${teamName}`);
    return { updated: 0 };
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id)
    .order('name');

  if (!athletes || athletes.length === 0) {
    console.log(`No athletes in database for ${teamName}`);
    return { updated: 0 };
  }

  console.log(`Found ${athletes.length} athletes in database`);

  const page = await browser.newPage();
  let updated = 0;

  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get all athlete links
    const rosterLinks = await page.evaluate((teamName) => {
      const links = [];

      // For LSU, extract athlete names from URLs since the page has combined men's/women's roster
      if (teamName === 'LSU') {
        document.querySelectorAll('a[href*="/roster/player/"]').forEach(bioLink => {
          // Extract name from URL: /roster/player/jon-avdiu/ -> Jon Avdiu
          const urlParts = bioLink.href.split('/roster/player/')[1]?.split('/')[0];
          if (urlParts && !bioLink.href.includes('/coach')) {
            const name = urlParts.split('-').map(word =>
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            links.push({ name, url: bioLink.href });
          }
        });
      } else {
        // For other teams, get all roster links
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
      }

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
    }, teamName);

    console.log(`Found ${rosterLinks.length} athletes on roster page\n`);

    // For each athlete in our database, find their profile URL
    for (const athlete of athletes) {
      const match = rosterLinks.find(r => r.name === athlete.name);

      if (match) {
        console.log(`  Updating: ${athlete.name}`);

        // Scrape photo
        const photoUrl = await scrapeAthletePhoto(page, match.url);
        const finalPhotoUrl = photoUrl || athlete.photo_url || team.logo_url;

        await supabase
          .from('athletes')
          .update({
            profile_url: match.url,
            photo_url: finalPhotoUrl,
          })
          .eq('id', athlete.id);

        console.log(`    ✅ Updated with profile URL ${photoUrl ? '+ photo' : ''}`);
        updated++;
      } else {
        console.log(`  ⚠️  Not found on roster: ${athlete.name}`);
      }

      await page.waitForTimeout(500);
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  } finally {
    await page.close();
  }

  console.log(`\n${teamName} Summary: ${updated}/${athletes.length} athletes updated`);
  return { updated };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  console.log('\n🎯 FIXING REMAINING 5 TEAMS');
  console.log('Adding profile URLs and photos for athletes already in database...\n');

  const results = {};
  for (const [teamName, rosterUrl] of Object.entries(teamUrls)) {
    results[teamName] = await updateTeamAthletes(browser, teamName, rosterUrl);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ UPDATE COMPLETE');
  console.log('='.repeat(70));

  let totalUpdated = 0;
  Object.entries(results).forEach(([team, stats]) => {
    console.log(`${team}: ${stats.updated} athletes updated`);
    totalUpdated += stats.updated;
  });

  console.log(`\nGrand Total: ${totalUpdated} athletes updated`);
}

main();
