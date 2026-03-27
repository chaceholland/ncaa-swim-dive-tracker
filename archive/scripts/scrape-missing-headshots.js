require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Known roster URLs for teams with missing headshots
const ROSTER_URLS = {
  'LSU': 'https://lsusports.net/sports/mens-swimming-and-diving/roster',
  'Arizona State': 'https://thesundevils.com/sports/mens-swimming-and-diving/roster',
  'Penn State': 'https://gopsusports.com/sports/mens-swimming-and-diving/roster',
  'Notre Dame': 'https://und.com/sports/mens-swimming-and-diving/roster',
  'TCU': 'https://gofrogs.com/sports/mens-swimming-and-diving/roster',
  'South Carolina': 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster',
  'Cal': 'https://calbears.com/sports/mens-swimming-and-diving/roster',
  'Indiana': 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster',
  'Duke': 'https://goduke.com/sports/mens-swimming-and-diving/roster',
  'Georgia Tech': 'https://ramblinwreck.com/sports/mens-swimming-and-diving/roster',
  'Army': 'https://goarmywestpoint.com/sports/mens-swimming-and-diving/roster',
  'Boston College': 'https://bceagles.com/sports/mens-swimming-and-diving/roster',
  'Stanford': 'https://gostanford.com/sports/mens-swimming-diving/roster',
  'Yale': 'https://yalebulldogs.com/sports/mens-swimming-and-diving/roster',
  'Purdue': 'https://purduesports.com/sports/mens-swimming-and-diving/roster',
};

function decodeImgproxyUrl(imgproxyUrl) {
  if (!imgproxyUrl || !imgproxyUrl.includes('imgproxy')) {
    return imgproxyUrl;
  }

  try {
    const match = imgproxyUrl.match(/\/([^\/]+)\.(jpg|png|webp)$/);
    if (!match) return imgproxyUrl;

    const base64Url = match[1];
    const decodedUrl = Buffer.from(base64Url, 'base64').toString('utf-8');

    if (decodedUrl.includes('storage.googleapis.com')) {
      return decodedUrl;
    }

    return imgproxyUrl;
  } catch (error) {
    return imgproxyUrl;
  }
}

async function scrapeAthleteProfile(page, profileUrl, athleteName) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate((name) => {
      // Try multiple strategies to find the athlete photo

      // Strategy 1: Look for lazy-loaded images with url attribute
      const lazyImages = document.querySelectorAll('img[url]');
      for (const img of lazyImages) {
        const url = img.getAttribute('url');
        const alt = img.alt || '';

        if (url && !url.includes('logo') && !url.includes('Logo') &&
            !url.includes('footer') && !url.includes('icon') &&
            !alt.toLowerCase().includes('logo')) {
          return url;
        }
      }

      // Strategy 2: Look for images with athlete-related classes/attributes
      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.src || '';
        const alt = img.alt || '';
        const className = img.className || '';

        if (!src || src.startsWith('data:')) continue;

        // Skip obvious non-athlete images
        if (src.includes('logo') || src.includes('Logo') ||
            src.includes('footer') || src.includes('icon') ||
            src.includes('nav') || src.includes('MainNav') ||
            alt.toLowerCase().includes('logo')) {
          continue;
        }

        // Look for athlete-specific patterns
        if (className.includes('headshot') || className.includes('player') ||
            className.includes('athlete') || className.includes('roster') ||
            alt.toLowerCase().includes('headshot') ||
            alt.toLowerCase().includes(name.toLowerCase().split(' ')[0])) {
          return src;
        }

        // Check if it's in an images path with reasonable size
        if ((src.includes('/images/') || src.includes('cloudfront.net') ||
             src.includes('imgproxy') || src.includes('sidearm')) &&
            (src.includes('.jpg') || src.includes('.png') || src.includes('.webp'))) {
          return src;
        }
      }

      return null;
    }, athleteName);

    // Upgrade quality if possible
    if (photoUrl) {
      if (photoUrl.includes('?width=')) {
        try {
          const url = new URL(photoUrl);
          url.searchParams.set('width', '1920');
          url.searchParams.set('height', '1920');
          return url.toString();
        } catch {
          return photoUrl;
        }
      }

      // Decode imgproxy URLs
      if (photoUrl.includes('imgproxy')) {
        return decodeImgproxyUrl(photoUrl);
      }

      return photoUrl;
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function scrapeRosterPage(page, rosterUrl) {
  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const athletes = await page.evaluate(() => {
      const results = [];

      // Try multiple roster link patterns
      const selectors = [
        'a[href*="/roster/"]',
        'a[href*="/player/"]',
        'a[href*="/athlete/"]',
      ];

      for (const selector of selectors) {
        const links = document.querySelectorAll(selector);

        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href || href.includes('coaches') || href.includes('staff')) continue;

          const name = link.textContent.trim();
          if (!name || name.length < 2) continue;

          const fullUrl = href.startsWith('http') ? href : window.location.origin + href;

          // Avoid duplicates
          if (!results.find(r => r.url === fullUrl)) {
            results.push({ name, url: fullUrl });
          }
        }
      }

      return results;
    });

    return athletes;
  } catch (error) {
    console.log(`    Error scraping roster: ${error.message}`);
    return [];
  }
}

async function fixTeam(teamName, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FIXING: ${teamName}`);
  console.log('='.repeat(70));

  const rosterUrl = ROSTER_URLS[teamName];
  if (!rosterUrl) {
    console.log(`  ⚠️  No roster URL configured`);
    return { updated: 0, found: 0 };
  }

  // Get team
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`  ❌ Team not found in database`);
    return { updated: 0, found: 0 };
  }

  // Get athletes with missing headshots
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id);

  const needsHeadshots = athletes.filter(a =>
    !a.photo_url ||
    a.photo_url.includes('/logos/') ||
    a.photo_url === team.logo_url
  );

  console.log(`\n${needsHeadshots.length}/${athletes.length} athletes need headshots`);

  if (needsHeadshots.length === 0) {
    console.log(`  ✅ All athletes already have headshots`);
    return { updated: 0, found: 0 };
  }

  const page = await browser.newPage();

  // Scrape roster page for profile URLs
  console.log(`\nScraping roster page...`);
  const profileUrls = await scrapeRosterPage(page, rosterUrl);
  console.log(`Found ${profileUrls.length} profile URLs\n`);

  let updated = 0;
  let found = 0;

  for (const athlete of needsHeadshots) {
    console.log(`${athlete.name}:`);

    // Find matching profile URL
    const profileMatch = profileUrls.find(p => {
      const pLower = p.name.toLowerCase().replace(/\s+/g, ' ').trim();
      const aLower = athlete.name.toLowerCase().replace(/\s+/g, ' ').trim();

      // Try various matching strategies
      return pLower.includes(aLower) ||
             aLower.includes(pLower) ||
             pLower.split(' ').some(word => aLower.includes(word) && word.length > 3) ||
             aLower.split(' ').some(word => pLower.includes(word) && word.length > 3);
    });

    if (!profileMatch) {
      console.log(`  ⚠️  No profile URL found - keeping logo\n`);
      continue;
    }

    console.log(`  Scraping: ${profileMatch.url.substring(0, 60)}...`);
    const photoUrl = await scrapeAthleteProfile(page, profileMatch.url, athlete.name);

    if (photoUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);

      console.log(`  ✅ Found headshot\n`);
      found++;
      updated++;
    } else {
      console.log(`  ⚠️  No headshot found - keeping logo\n`);
    }
  }

  await page.close();

  console.log(`\n✅ ${teamName}: ${updated} updated (${found} headshots found)`);
  return { updated, found };
}

async function main() {
  console.log('\n🔧 SCRAPING MISSING HEADSHOTS');
  console.log('Finding athletes with missing photos...\n');

  const browser = await chromium.launch({ headless: true });

  let totalUpdated = 0;
  let totalFound = 0;

  // First, identify which teams need work
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .order('name');

  const teamsWithMissing = [];

  for (const team of teams) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, photo_url')
      .eq('team_id', team.id);

    const missing = athletes.filter(a =>
      !a.photo_url ||
      a.photo_url.includes('/logos/') ||
      a.photo_url === team.logo_url
    ).length;

    if (missing > 0 && ROSTER_URLS[team.name]) {
      teamsWithMissing.push({ name: team.name, missing });
    }
  }

  console.log('Teams with missing headshots:');
  teamsWithMissing.forEach(t => console.log(`  - ${t.name}: ${t.missing} missing`));
  console.log('');

  // Process each team
  for (const team of teamsWithMissing) {
    const result = await fixTeam(team.name, browser);
    totalUpdated += result.updated;
    totalFound += result.found;
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ MISSING HEADSHOTS SCRAPE COMPLETE');
  console.log(`   Total updated: ${totalUpdated}`);
  console.log(`   Headshots found: ${totalFound}`);
  console.log('='.repeat(70));
}

main();
