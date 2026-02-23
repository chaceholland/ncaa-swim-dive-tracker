require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function scrapeAthletePhoto(page, profileUrl, athleteName) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
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

      const isPortraitOrientation = (img) => {
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        if (width === 0 || height === 0) return false;
        const aspectRatio = width / height;
        return aspectRatio >= 0.5 && aspectRatio <= 0.8;
      };

      // Look for specific roster/bio photo selectors
      const headshotSelectors = [
        'img.roster-bio-photo__image',
        'img.sidearm-roster-player-image',
        'img.roster-player-image',
        '.s-person-card__photo img',
        '.roster-photo img',
        'img.player-headshot',
        'img[class*="headshot"]',
        'img[class*="bio-photo"]',
      ];

      for (const selector of headshotSelectors) {
        const img = document.querySelector(selector);
        if (img && img.src && isValidHeadshot(img.src)) {
          return img.src;
        }
      }

      // Find portrait-oriented images from athletic domains
      const athleticDomains = [
        'sidearmdev.com',
        'sidearm.sites',
        'storage.googleapis.com',
        'imgproxy',
        'purduesports.com',
      ];

      const portraitHeadshots = [];
      const allImages = document.querySelectorAll('img');

      for (const img of allImages) {
        const src = img.src;
        if (!isValidHeadshot(src)) continue;
        if (!athleticDomains.some(domain => src.includes(domain))) continue;

        if (isPortraitOrientation(img)) {
          const width = img.naturalWidth || img.width || 0;
          const height = img.naturalHeight || img.height || 0;
          const isRosterPath = src.includes('/images/') ||
                               src.includes('/roster/') ||
                               src.includes('crop?url=');

          portraitHeadshots.push({
            src,
            width,
            height,
            area: width * height,
            isRosterPath,
            aspectRatio: width / height
          });
        }
      }

      if (portraitHeadshots.length > 0) {
        portraitHeadshots.sort((a, b) => {
          if (a.isRosterPath && !b.isRosterPath) return -1;
          if (!a.isRosterPath && b.isRosterPath) return 1;

          const idealRatio = 0.66;
          const aDiff = Math.abs(a.aspectRatio - idealRatio);
          const bDiff = Math.abs(b.aspectRatio - idealRatio);

          if (Math.abs(aDiff - bDiff) < 0.1) {
            return b.area - a.area;
          }
          return aDiff - bDiff;
        });

        return portraitHeadshots[0].src;
      }

      return null;
    });

    return photoUrl;
  } catch (error) {
    console.log(`    ⚠️  Error scraping: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔧 FRESH PURDUE SCRAPE: Delete all and rescrape\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Purdue')
    .single();

  console.log('Step 1: Delete ALL Purdue athletes\n');

  const { data: toDelete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('team_id', team.id);

  console.log(`Deleting ${toDelete.length} athletes...`);

  for (const athlete of toDelete) {
    await supabase
      .from('athletes')
      .delete()
      .eq('id', athlete.id);
  }

  console.log(`✅ Deleted all ${toDelete.length} athletes\n`);

  console.log('Step 2: Scrape fresh roster from website\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://purduesports.com/sports/mens-swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  });
  await page.waitForTimeout(3000);

  const athletes = await page.evaluate(() => {
    const links = [];
    document.querySelectorAll('a[href*="/roster/"]').forEach(bioLink => {
      if (bioLink.href.includes('/roster/') && !bioLink.href.includes('/coach')) {
        const name = bioLink.textContent?.trim();
        if (name && name.length > 0 && name.length < 50) {
          links.push({ name, profileUrl: bioLink.href });
        }
      }
    });

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    links.forEach(l => {
      const key = l.name + '||' + l.profileUrl;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(l);
      }
    });

    return unique;
  });

  console.log(`Found ${athletes.length} athletes on roster page\n`);

  let foundPhotos = 0;

  for (const athlete of athletes) {
    console.log(`${athlete.name}:`);

    const photoUrl = await scrapeAthletePhoto(page, athlete.profileUrl, athlete.name);

    if (photoUrl) {
      // Upgrade quality
      let finalUrl = photoUrl;
      if (photoUrl.includes('?width=')) {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        url.searchParams.set('height', '1920');
        finalUrl = url.toString();
      }

      await supabase
        .from('athletes')
        .insert({
          team_id: team.id,
          name: athlete.name,
          profile_url: athlete.profileUrl,
          photo_url: finalUrl
        });

      console.log(`  ✅ Added with headshot: ${finalUrl.substring(0, 60)}...`);
      foundPhotos++;
    } else {
      await supabase
        .from('athletes')
        .insert({
          team_id: team.id,
          name: athlete.name,
          profile_url: athlete.profileUrl,
          photo_url: team.logo_url
        });

      console.log(`  ⚠️  Added with team logo (no photo found)`);
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total athletes: ${athletes.length}`);
  console.log(`Found headshots: ${foundPhotos}`);
  console.log(`Success rate: ${((foundPhotos/athletes.length)*100).toFixed(1)}%`);
}

main();
