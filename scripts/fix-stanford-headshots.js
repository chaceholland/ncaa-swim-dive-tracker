require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function decodeImgproxyUrl(imgproxyUrl) {
  if (!imgproxyUrl || !imgproxyUrl.includes('imgproxy')) {
    return imgproxyUrl;
  }

  try {
    // Extract the base64 part from Stanford's imgproxy URLs
    // Format: .../imgproxy/{hash}/rs:fit:1980:0:0:0/g:ce:0:0/q:90/{base64}.jpg
    const match = imgproxyUrl.match(/\/([^\/]+)\.(jpg|png|webp)$/);
    if (!match) return imgproxyUrl;

    const base64Url = match[1];
    const decodedUrl = Buffer.from(base64Url, 'base64').toString('utf-8');

    // Return the Google Cloud Storage URL directly
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
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate((name) => {
      // Look for the athlete photo - try multiple approaches

      // Approach 1: Look for img with url attribute (lazy loaded)
      const lazyImages = document.querySelectorAll('img[url]');
      for (const img of lazyImages) {
        const url = img.getAttribute('url');
        const alt = img.alt || '';
        const className = img.className || '';

        // Skip logos and navigation
        if (url.includes('logo') || url.includes('footer') || url.includes('icon')) continue;
        if (alt.toLowerCase().includes('logo')) continue;

        // Look for athlete photos (usually in roster-card or profile areas)
        if (className.includes('roster') || className.includes('profile') || className.includes('player')) {
          return url;
        }

        // Check if URL contains storage.googleapis.com or imgproxy (likely athlete photo)
        if ((url.includes('storage.googleapis.com') || url.includes('imgproxy')) &&
            !url.includes('header') && !url.includes('nav')) {
          return url;
        }
      }

      // Approach 2: Look for regular img src
      const images = document.querySelectorAll('img');
      for (const img of images) {
        const src = img.src || '';
        const alt = img.alt || '';

        if (!src || src.startsWith('data:')) continue;
        if (src.includes('logo') || src.includes('footer') || src.includes('icon')) continue;
        if (alt.toLowerCase().includes('logo')) continue;

        // Check for athlete-specific images
        if ((src.includes('imgproxy') || src.includes('storage.googleapis.com')) &&
            !src.includes('header') && !src.includes('nav')) {
          return src;
        }
      }

      return null;
    }, athleteName);

    // Decode imgproxy URL if found
    if (photoUrl && photoUrl.includes('imgproxy')) {
      const decoded = decodeImgproxyUrl(photoUrl);
      return decoded;
    }

    return photoUrl;
  } catch (error) {
    console.log(`      Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING STANFORD HEADSHOTS');
  console.log('Scraping athlete profiles and decoding imgproxy URLs...\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Stanford')
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Total athletes: ${dbAthletes.length}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get all swimming roster profile URLs
  console.log('\nScraping roster page for profile URLs...');
  await page.goto('https://gostanford.com/sports/mens-swimming-diving/roster', {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  });
  await page.waitForTimeout(2000);

  const profileUrls = await page.evaluate(() => {
    const results = [];
    const links = document.querySelectorAll('a[href*="/roster/player/"]');

    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      const name = link.textContent.trim();
      if (!name || name.length < 2) continue;

      const fullUrl = href.startsWith('http') ? href : window.location.origin + href;
      results.push({ name, url: fullUrl });
    }

    return results;
  });

  console.log(`Found ${profileUrls.length} profile URLs\n`);

  let updated = 0;
  let decoded = 0;
  let newHeadshots = 0;

  for (const athlete of dbAthletes) {
    console.log(`${athlete.name}:`);

    // Check if current photo needs updating
    const hasLogo = !athlete.photo_url || athlete.photo_url === team.logo_url || athlete.photo_url.includes('/logos/');
    const hasImgproxy = athlete.photo_url && athlete.photo_url.includes('imgproxy');

    if (!hasLogo && !hasImgproxy) {
      console.log('  ✓ Already has direct URL\n');
      continue;
    }

    // Find profile URL
    const profileMatch = profileUrls.find(p => {
      const pLower = p.name.toLowerCase();
      const aLower = athlete.name.toLowerCase();
      return pLower.includes(aLower) || aLower.includes(pLower);
    });

    if (!profileMatch) {
      console.log('  ⚠️  No profile URL found\n');
      continue;
    }

    console.log(`  Scraping: ${profileMatch.url}`);
    const photoUrl = await scrapeAthleteProfile(page, profileMatch.url, athlete.name);

    if (photoUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', athlete.id);

      if (hasLogo) {
        console.log('  ✅ Found new headshot');
        newHeadshots++;
      } else {
        console.log('  ✅ Decoded imgproxy URL');
        decoded++;
      }
      updated++;
    } else {
      if (hasLogo) {
        console.log('  ⚠️  No headshot found - keeping logo');
      } else {
        console.log('  ⚠️  Could not decode - keeping current URL');
      }
    }
    console.log('');
  }

  await browser.close();

  console.log('='.repeat(70));
  console.log(`✅ STANFORD FIX COMPLETE`);
  console.log(`   ${updated} updated (${newHeadshots} new headshots, ${decoded} decoded)`);
  console.log('='.repeat(70));
}

main();
