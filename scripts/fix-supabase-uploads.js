require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ROSTER_URLS = {
  'Arizona State': 'https://thesundevils.com/sports/mens-swimming-diving/roster',
  'Cornell': 'https://cornellbigred.com/sports/mens-swimming-and-diving/roster',
  'Duke': 'https://goduke.com/sports/mens-swimming-and-diving/roster',
  'Georgia Tech': 'https://ramblinwreck.com/sports/mens-swimming-and-diving/roster',
  'Louisville': 'https://gocards.com/sports/mens-swimming-and-diving/roster',
  'NC State': 'https://gopack.com/sports/mens-swimming-and-diving/roster',
  'North Carolina': 'https://goheels.com/sports/mens-swimming-and-diving/roster',
  'Notre Dame': 'https://und.com/sports/mens-swimming-and-diving/roster',
  'Ohio State': 'https://ohiostatebuckeyes.com/sports/m-swim/roster',
  'Penn': 'https://pennathletics.com/sports/mens-swimming-and-diving/roster',
  'Pittsburgh': 'https://pittsburghpanthers.com/sports/mens-swimming-and-diving/roster',
  'TCU': 'https://gofrogs.com/sports/mens-swimming-and-diving/roster',
  'Towson': 'https://towsontigers.com/sports/mens-swimming-and-diving/roster',
  'Virginia': 'https://virginiasports.com/sports/mens-swimming-and-diving/roster',
  'Virginia Tech': 'https://hokiesports.com/sports/mens-swimming-and-diving/roster',
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
      // Strategy 1: Lazy-loaded images with url attribute
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

      // Strategy 2: Regular images
      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.src || '';
        const alt = img.alt || '';

        if (!src || src.startsWith('data:')) continue;

        // Skip non-athlete images
        if (src.includes('logo') || src.includes('Logo') ||
            src.includes('footer') || src.includes('icon') ||
            src.includes('nav') || src.includes('MainNav') ||
            alt.toLowerCase().includes('logo')) {
          continue;
        }

        // Look for athlete images
        if ((src.includes('/images/') || src.includes('cloudfront.net') ||
             src.includes('imgproxy') || src.includes('sidearm')) &&
            (src.includes('.jpg') || src.includes('.png') || src.includes('.webp'))) {
          return src;
        }
      }

      return null;
    }, athleteName);

    if (photoUrl) {
      // Upgrade quality
      if (photoUrl.includes('?width=') || photoUrl.includes('crop')) {
        try {
          const url = new URL(photoUrl);
          url.searchParams.set('width', '1920');
          url.searchParams.set('height', '1920');
          return url.toString();
        } catch {
          // If URL parsing fails, decode imgproxy
          if (photoUrl.includes('imgproxy')) {
            return decodeImgproxyUrl(photoUrl);
          }
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

          if (!results.find(r => r.url === fullUrl)) {
            results.push({ name, url: fullUrl });
          }
        }
      }

      return results;
    });

    return athletes;
  } catch (error) {
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
    return 0;
  }

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`  ❌ Team not found`);
    return 0;
  }

  // Get athletes with Supabase-uploaded images
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%supabase.co/storage%');

  console.log(`\n${athletes.length} athletes with Supabase uploads`);

  if (athletes.length === 0) {
    console.log(`  ✅ No Supabase uploads to fix`);
    return 0;
  }

  const page = await browser.newPage();

  console.log(`\nScraping roster...`);
  const profileUrls = await scrapeRosterPage(page, rosterUrl);
  console.log(`Found ${profileUrls.length} profile URLs\n`);

  let updated = 0;

  for (const athlete of athletes) {
    console.log(`${athlete.name}:`);

    const profileMatch = profileUrls.find(p => {
      const pLower = p.name.toLowerCase().replace(/\s+/g, ' ').trim();
      const aLower = athlete.name.toLowerCase().replace(/\s+/g, ' ').trim();

      return pLower.includes(aLower) ||
             aLower.includes(pLower) ||
             pLower.split(' ').some(word => aLower.includes(word) && word.length > 3) ||
             aLower.split(' ').some(word => pLower.includes(word) && word.length > 3);
    });

    if (!profileMatch) {
      console.log(`  ⚠️  No profile URL found\n`);
      continue;
    }

    console.log(`  Scraping...`);
    const photoUrl = await scrapeAthleteProfile(page, profileMatch.url, athlete.name);

    if (photoUrl && !photoUrl.includes('supabase.co')) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);

      console.log(`  ✅ Upgraded to high-res\n`);
      updated++;
    } else {
      console.log(`  ⚠️  No better image found\n`);
    }
  }

  await page.close();

  console.log(`\n✅ ${teamName}: ${updated} upgraded`);
  return updated;
}

async function main() {
  console.log('\n🔧 FIXING SUPABASE-UPLOADED LOW-QUALITY IMAGES');
  console.log('Replacing with high-res images from source...\n');

  const browser = await chromium.launch({ headless: true });

  let totalUpdated = 0;

  const teams = Object.keys(ROSTER_URLS);

  for (const team of teams) {
    const updated = await fixTeam(team, browser);
    totalUpdated += updated;
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ SUPABASE UPLOAD FIX COMPLETE');
  console.log(`   Total upgraded: ${totalUpdated}`);
  console.log('='.repeat(70));
}

main();
