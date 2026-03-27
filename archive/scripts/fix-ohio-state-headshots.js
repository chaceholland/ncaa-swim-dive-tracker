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
        'ohiostatebuckeyes.com',
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
    console.log(`    ⚠️  Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING: Ohio State Headshots\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Ohio State')
    .single();

  // Get athletes with Supabase uploads
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id)
    .like('photo_url', '%supabase.co/storage%');

  console.log(`Found ${athletes.length} athletes with Supabase uploads\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let upgraded = 0;
  let failed = 0;

  for (const athlete of athletes) {
    console.log(`${athlete.name}:`);

    if (!athlete.profile_url) {
      console.log(`  ⚠️  No profile URL - skipping`);
      failed++;
      continue;
    }

    const photoUrl = await scrapeAthletePhoto(page, athlete.profile_url, athlete.name);

    if (photoUrl) {
      // Upgrade to max quality
      let finalUrl = photoUrl;
      if (photoUrl.includes('?width=')) {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        url.searchParams.set('height', '1920');
        finalUrl = url.toString();
      }

      console.log(`  ✅ Upgraded: ${finalUrl.substring(0, 70)}...`);

      await supabase
        .from('athletes')
        .update({ photo_url: finalUrl })
        .eq('id', athlete.id);

      upgraded++;
    } else {
      console.log(`  ❌ No photo found - keeping Supabase upload`);
      failed++;
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total: ${athletes.length}`);
  console.log(`Upgraded: ${upgraded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((upgraded/athletes.length)*100).toFixed(1)}%`);
}

main();
