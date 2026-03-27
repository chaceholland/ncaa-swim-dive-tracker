require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MISSING_HEADSHOTS = {
  'Alabama': ['Colten Cryer', 'Nigel Chambers', 'Paul Mathews', 'Peter Edin'],
  'Missouri': ['Collier Dyer', 'Luke Nebrich', 'Oliver Millán de Miguel', 'Tanner Braunton', 'Tommaso Zannella'],
  'Indiana': ['Aaron Shackell', 'Colin Kostbade', 'Will Sowle', 'Paul Kelley'],
  'USC': ['Aleksandar Beljic'],
  'Minnesota': ['Zach Mertens', 'Zachary Hawley'],
  'Ohio State': ['Brian Armelli', 'Michael Butler', 'Patrick Hemingway'],
  'Florida State': ['Aidan Siers']
};

const ROSTER_URLS = {
  'Alabama': 'https://rolltide.com/sports/mens-swimming-and-diving/roster',
  'Missouri': 'https://mutigers.com/sports/mens-swimming-and-diving/roster',
  'Indiana': 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster',
  'USC': 'https://usctrojans.com/sports/mens-swimming-and-diving/roster',
  'Minnesota': 'https://gophersports.com/sports/mens-swimming-and-diving/roster',
  'Ohio State': 'https://ohiostatebuckeyes.com/sports/m-swim/roster',
  'Florida State': 'https://seminoles.com/sports/mens-swimming-and-diving/roster'
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

async function scrapeAthleteProfile(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));

      // Try to find headshot image
      for (const img of images) {
        const src = img.src || img.getAttribute('url') || '';
        const alt = img.alt || '';

        if (!src || src.startsWith('data:')) continue;

        // Skip logos
        if (src.includes('logo') || src.includes('footer') || src.includes('icon') ||
            alt.toLowerCase().includes('logo')) continue;

        // Look for athlete images
        if ((src.includes('/images/') || src.includes('cloudfront.net') || src.includes('imgproxy')) &&
            (src.includes('.jpg') || src.includes('.png') || src.includes('.webp'))) {
          // Upgrade quality if possible
          if (src.includes('?width=')) {
            try {
              const url = new URL(src);
              url.searchParams.set('width', '1200');
              return url.toString();
            } catch {
              return src;
            }
          }
          return src;
        }
      }

      return null;
    });

    // Decode imgproxy if needed
    if (photoUrl && photoUrl.includes('imgproxy')) {
      return decodeImgproxyUrl(photoUrl);
    }

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function fixTeam(teamName, athleteNames, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FIXING: ${teamName}`);
  console.log('='.repeat(70));

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log('  ⚠️  Team not found in database');
    return;
  }

  const rosterUrl = ROSTER_URLS[teamName];
  if (!rosterUrl) {
    console.log('  ⚠️  No roster URL configured');
    return;
  }

  const page = await browser.newPage();

  // Get profile URLs from roster
  await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  const profileUrls = await page.evaluate(() => {
    const results = [];
    const links = document.querySelectorAll('a[href*="/roster/"]');

    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href || href.includes('coaches') || href.includes('staff')) continue;

      const name = link.textContent.trim();
      if (!name || name.length < 2) continue;

      const fullUrl = href.startsWith('http') ? href : window.location.origin + href;
      results.push({ name, url: fullUrl });
    }

    return results;
  });

  console.log(`\nFound ${profileUrls.length} profile URLs\n`);

  let updated = 0;

  for (const athleteName of athleteNames) {
    console.log(`${athleteName}:`);

    // Find in database
    const { data: athlete } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id)
      .ilike('name', `%${athleteName}%`)
      .maybeSingle();

    if (!athlete) {
      console.log('  ⚠️  Not found in database\n');
      continue;
    }

    // Skip if already has a non-logo photo
    if (athlete.photo_url && !athlete.photo_url.includes('/logos/')) {
      console.log('  ✓ Already has headshot\n');
      continue;
    }

    // Find profile URL
    const profileMatch = profileUrls.find(p => {
      const pLower = p.name.toLowerCase().replace(/\s+/g, ' ');
      const aLower = athleteName.toLowerCase().replace(/\s+/g, ' ');
      return pLower.includes(aLower) || aLower.includes(pLower);
    });

    if (!profileMatch) {
      console.log('  ⚠️  No profile URL found\n');
      continue;
    }

    console.log(`  Scraping: ${profileMatch.url.substring(0, 60)}...`);
    const photoUrl = await scrapeAthleteProfile(page, profileMatch.url);

    if (photoUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);
      console.log('  ✅ Headshot found\n');
      updated++;
    } else {
      console.log('  ⚠️  No headshot found - keeping logo\n');
    }
  }

  await page.close();

  console.log(`✅ ${teamName}: ${updated} headshots added`);
}

async function main() {
  console.log('\n🔧 FIXING MISSING HEADSHOTS');
  console.log('Scraping athlete profiles...\n');

  const browser = await chromium.launch({ headless: true });

  for (const [teamName, athleteNames] of Object.entries(MISSING_HEADSHOTS)) {
    await fixTeam(teamName, athleteNames, browser);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ MISSING HEADSHOTS FIX COMPLETE');
  console.log('='.repeat(70));
}

main();
