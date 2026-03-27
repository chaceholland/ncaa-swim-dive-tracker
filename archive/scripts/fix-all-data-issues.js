require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Data quality fixes organized by issue type
const DATA_FIXES = {
  // Coaches to remove (incorrectly added as athletes)
  coaches: [
    { name: 'Caleb Lawrence', team: 'Tennessee' },
    { name: 'Andrew Hodgson', team: 'Alabama' },
    { name: 'Jake Larson', team: 'Alabama' },
    { name: 'Isa Chavez-Varela', team: 'Alabama' },
    { name: 'Michael White', team: 'Alabama' },
    { name: 'Richard Salhus', team: 'Alabama' },
    { name: 'Andrew Grevers', team: 'Missouri' },
    { name: 'Andrew Sansoucie', team: 'Missouri' },
    { name: 'Kyle Bogner', team: 'Missouri' },
    { name: 'Jordan Agliano', team: 'South Carolina' },
    { name: 'Jason Calanog', team: 'South Carolina' },
    { name: 'Robert Pinter', team: 'South Carolina' },
  ],

  // Female athletes on men's roster
  femaleAthletes: [
    { name: 'Alex Mitchell', team: 'South Carolina' },
    { name: 'Dylan Scholes', team: 'South Carolina' },
  ],

  // Athletes needing headshot rescrape
  missingHeadshots: {
    'Georgia': [
      'Elliot Woodburn', 'Jayson Ross', 'Kris Mihaylov', 'Luca Urlando',
      'Matthew Bray', 'Ruard van Renen', 'Tyler Grafmiller', 'Tomas Koski'
    ],
    'Tennessee': [
      'Gui Caribe', 'Nikoli Blackman', 'Owen Redfearn', 'Nick Stone',
      'Nick Simons', 'Martin Espernberger'
    ],
    'Alabama': [
      'Colten Cryer', 'Nigel Chambers', 'Paul Mathews', 'Peter Edin'
    ],
    'Missouri': [
      'Collier Dyer', 'Luke Nebrich', 'Oliver Millán de Miguel',
      'Tanner Braunton', 'Tommaso Zannella'
    ],
    'Kentucky': [
      'Jordan Lieberman', 'Matt Martinez', 'Sam Duncan'
    ],
  },

  // Wrong headshots (rescrape these)
  wrongHeadshots: [
    { name: 'Ethan Dumesnil', team: 'Tennessee' },
    { name: 'Lúcio Paula', team: 'Tennessee' },
  ],
};

// Team roster URLs
const TEAM_URLS = {
  'Georgia': 'https://georgiadogs.com/sports/msd/roster',
  'Tennessee': 'https://utsports.com/sports/mens-swimming-and-diving/roster',
  'Alabama': 'https://rolltide.com/sports/swimming-and-diving/roster',
  'Missouri': 'https://mutigers.com/sports/swimming-and-diving/roster',
  'Kentucky': 'https://ukathletics.com/sports/swimming/roster/',
  'LSU': 'https://lsusports.net/sports/sd/roster/',
};

async function removeAthletes(athletesList, reason) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`REMOVING ${reason.toUpperCase()}`);
  console.log('='.repeat(70));

  let removed = 0;

  for (const { name, team } of athletesList) {
    const { data: teamData } = await supabase
      .from('teams')
      .select('id')
      .eq('name', team)
      .single();

    if (!teamData) {
      console.log(`  ⚠️  Team not found: ${team}`);
      continue;
    }

    const { data: athlete } = await supabase
      .from('athletes')
      .select('id')
      .eq('team_id', teamData.id)
      .eq('name', name)
      .maybeSingle();

    if (athlete) {
      const { error } = await supabase
        .from('athletes')
        .delete()
        .eq('id', athlete.id);

      if (!error) {
        console.log(`  ✅ Removed: ${name} (${team})`);
        removed++;
      } else {
        console.log(`  ❌ Error removing ${name}: ${error.message}`);
      }
    } else {
      console.log(`  ⚠️  Not found: ${name} (${team})`);
    }
  }

  console.log(`\nTotal ${reason} removed: ${removed}/${athletesList.length}`);
}

async function scrapeAthletePhoto(page, athleteUrl, athleteName) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const photoUrl = await page.evaluate((name) => {
      const isValidHeadshot = (src) => {
        if (!src) return false;
        const lower = src.toLowerCase();
        if (lower.startsWith('data:image')) return false;
        return !lower.includes('placeholder') &&
               !lower.includes('default') &&
               !lower.includes('logo') &&
               !lower.includes('team-logo') &&
               !lower.includes('headshot_generic') &&
               !lower.includes('silhouette');
      };

      const upgradeQuality = (src) => {
        if (src.includes('width=') || src.includes('height=')) {
          src = src.replace(/width=\d+/, 'width=1200');
          src = src.replace(/height=\d+/, 'height=1200');
        }
        return src;
      };

      const selectors = [
        'img.sidearm-roster-player-image',
        'img.roster-bio-photo__image',
        '.s-person-card__photo img',
        '.roster-photo img',
        'img[itemprop="image"]',
        'picture img',
        '.player-image img',
        '.s-person-details__media img',
        '.roster-player-hero-image__image',
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src && isValidHeadshot(img.src)) {
          return upgradeQuality(img.src);
        }
      }

      if (name) {
        const nameParts = name.toLowerCase().split(' ');
        const allImages = document.querySelectorAll('img');

        for (const img of allImages) {
          const alt = (img.alt || '').toLowerCase();
          const src = img.src;

          if (alt && nameParts.some(part => alt.includes(part)) && isValidHeadshot(src)) {
            if (src.includes('sidearmdev.com') ||
                src.includes('sidearm.sites') ||
                src.includes('cloudfront') ||
                src.includes('athletic') ||
                src.includes('roster') ||
                src.includes('imgproxy') ||
                src.includes('headshot')) {
              return upgradeQuality(src);
            }
          }
        }
      }

      const athleticDomains = [
        'sidearmdev.com',
        'sidearm.sites',
        'cloudfront.net',
        'imgproxy',
        'gamecocksonline.com',
        'lsusports.net',
        '12thman.com',
        'auburntigers.com/imgproxy',
        'storage.googleapis.com',
      ];

      const allImages = document.querySelectorAll('img');
      const validImages = [];

      for (const img of allImages) {
        const src = img.src;
        if (isValidHeadshot(src) && athleticDomains.some(domain => src.includes(domain))) {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          if (width >= 100 && height >= 100) {
            validImages.push({ src, width, height });
          }
        }
      }

      if (validImages.length > 0) {
        validImages.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        return upgradeQuality(validImages[0].src);
      }

      return null;
    }, athleteName);

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function rescrapeTeamHeadshots(browser, teamName, athleteNames) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESCRAPING: ${teamName}`);
  console.log('='.repeat(70));

  const rosterUrl = TEAM_URLS[teamName];
  if (!rosterUrl) {
    console.log(`  ⚠️  No roster URL configured for ${teamName}`);
    return { updated: 0 };
  }

  const page = await browser.newPage();

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`  ⚠️  Team not found: ${teamName}`);
    await page.close();
    return { updated: 0 };
  }

  let updated = 0;

  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const rosterLinks = await page.evaluate((teamName) => {
      const links = [];

      if (teamName === 'LSU') {
        document.querySelectorAll('a[href*="/roster/player/"]').forEach(bioLink => {
          const urlParts = bioLink.href.split('/roster/player/')[1]?.split('/')[0];
          if (urlParts && !bioLink.href.includes('/coach')) {
            const name = urlParts.split('-').map(word =>
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            links.push({ name, url: bioLink.href });
          }
        });
      } else {
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

    for (const athleteName of athleteNames) {
      const match = rosterLinks.find(r => r.name === athleteName);

      if (match) {
        console.log(`  Processing: ${athleteName}`);

        const { data: athlete } = await supabase
          .from('athletes')
          .select('id')
          .eq('team_id', team.id)
          .eq('name', athleteName)
          .maybeSingle();

        if (athlete) {
          const photoUrl = await scrapeAthletePhoto(page, match.url, athleteName);

          if (photoUrl) {
            await supabase
              .from('athletes')
              .update({
                profile_url: match.url,
                photo_url: photoUrl,
              })
              .eq('id', athlete.id);

            console.log(`    ✅ Updated with headshot`);
            updated++;
          } else {
            await supabase
              .from('athletes')
              .update({
                profile_url: match.url,
              })
              .eq('id', athlete.id);

            console.log(`    ⚠️  No photo found, keeping current`);
          }
        } else {
          console.log(`    ⚠️  Not in database`);
        }
      } else {
        console.log(`  ⚠️  Not found on roster: ${athleteName}`);
      }

      await page.waitForTimeout(500);
    }

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  } finally {
    await page.close();
  }

  console.log(`\n${teamName} Summary: ${updated}/${athleteNames.length} headshots updated`);
  return { updated };
}

async function main() {
  console.log('\n🔧 COMPREHENSIVE DATA QUALITY FIX');
  console.log('Fixing all reported data issues...\n');

  // Step 1: Remove coaches
  await removeAthletes(DATA_FIXES.coaches, 'coaches');

  // Step 2: Remove female athletes from men's roster
  await removeAthletes(DATA_FIXES.femaleAthletes, 'female athletes');

  // Step 3: Rescrape missing and wrong headshots
  const browser = await chromium.launch({ headless: true });

  console.log(`\n${'='.repeat(70)}`);
  console.log('RESCRAPING HEADSHOTS');
  console.log('='.repeat(70));

  const results = {};

  // Rescrape missing headshots
  for (const [teamName, athleteNames] of Object.entries(DATA_FIXES.missingHeadshots)) {
    results[teamName] = await rescrapeTeamHeadshots(browser, teamName, athleteNames);
  }

  // Rescrape wrong headshots
  for (const { name, team } of DATA_FIXES.wrongHeadshots) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FIXING WRONG HEADSHOT: ${name} (${team})`);
    console.log('='.repeat(70));
    await rescrapeTeamHeadshots(browser, team, [name]);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ ALL DATA QUALITY FIXES COMPLETE');
  console.log('='.repeat(70));

  let totalHeadshotsFixed = 0;
  Object.entries(results).forEach(([team, stats]) => {
    console.log(`${team}: ${stats.updated} headshots fixed`);
    totalHeadshotsFixed += stats.updated;
  });

  console.log(`\nTotal headshots fixed: ${totalHeadshotsFixed}`);
}

main();
