require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function scrapeHeadshot(page, athleteName) {
  try {
    // Convert name to URL slug (lowercase, hyphens)
    const slug = athleteName.toLowerCase().replace(/\s+/g, '-');
    const url = `https://lsusports.net/sports/sd/roster/player/${slug}/`;

    console.log(`  Visiting: ${url}`);

    await page.goto(url, {
waitUntil: 'domcontentloaded',
      timeout: 20000
    });

    // Wait for images to load
    await page.waitForTimeout(4000);

    const debugInfo = await page.evaluate(() => {
      // Look for all images
      const allImages = Array.from(document.querySelectorAll('img'));

      // Get all images from Google Storage
      const googleStorageImages = allImages
        .filter(img => img.src && img.src.includes('storage.googleapis.com'))
        .map(img => ({
          src: img.src.substring(0, 80),
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          alt: img.alt || '',
        }));

      // Filter to potential headshots
      const candidates = allImages
        .map(img => ({
          src: img.src,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          alt: img.alt || '',
          class: img.className || ''
        }))
        .filter(img => {
          // Must have valid src from Google Storage
          if (!img.src || !img.src.includes('storage.googleapis.com')) return false;

          // Must not be a logo or icon
          const lower = img.src.toLowerCase() + img.alt.toLowerCase() + img.class.toLowerCase();
          if (lower.includes('logo') || lower.includes('icon')) return false;

          // Must have reasonable dimensions
          if (img.width < 100 || img.height < 100) return false;

          return true;
        })
        .map(img => ({
          ...img,
          aspectRatio: img.width / img.height
        }))
        .filter(img => {
          // Portrait orientation (0.5 to 0.8 aspect ratio)
          return img.aspectRatio >= 0.5 && img.aspectRatio <= 0.8;
        })
        .sort((a, b) => {
          // Prefer images closer to 2:3 aspect ratio
          const idealRatio = 0.66;
          const aDiff = Math.abs(a.aspectRatio - idealRatio);
          const bDiff = Math.abs(b.aspectRatio - idealRatio);

          if (Math.abs(aDiff - bDiff) < 0.05) {
            // If similar aspect ratios, prefer larger image
            return (b.width * b.height) - (a.width * a.height);
          }

          return aDiff - bDiff;
        });

      return {
        totalImages: allImages.length,
        googleStorageImages,
        photoUrl: candidates[0]?.src || null
      };
    });

    if (debugInfo.googleStorageImages.length > 0 && !debugInfo.photoUrl) {
      console.log(`    Found ${debugInfo.googleStorageImages.length} Google Storage images but none matched criteria:`);
      debugInfo.googleStorageImages.slice(0, 3).forEach(img => {
        console.log(`      - ${img.width}x${img.height} ${img.src}...`);
      });
    }

    const photoUrl = debugInfo.photoUrl;

    return photoUrl;
  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n📸 SCRAPING: LSU Athlete Headshots\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'LSU')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} LSU athletes\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let found = 0;
  let notFound = 0;

  // Scrape all athletes
  for (const athlete of athletes) {
    console.log(`${athlete.name}:`);

    const photoUrl = await scrapeHeadshot(page, athlete.name);

    if (photoUrl) {
      // Upgrade to max quality
      let finalUrl = photoUrl;
      if (photoUrl.includes('?')) {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        url.searchParams.set('height', '1920');
        finalUrl = url.toString();
      }

      console.log(`  ✅ Found: ${finalUrl.substring(0, 70)}...`);

      await supabase
        .from('athletes')
        .update({ photo_url: finalUrl })
        .eq('id', athlete.id);

      found++;
    } else {
      console.log(`  ❌ No headshot found`);
      notFound++;
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total: ${athletes.length}`);
  console.log(`Found: ${found}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Success rate: ${((found/athletes.length)*100).toFixed(1)}%`);
}

main();
