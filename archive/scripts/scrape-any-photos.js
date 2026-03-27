require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function scrapeAnyPhoto(page, profileUrl, athleteName) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const photoUrl = await page.evaluate(() => {
      const isValidHeadshot = (src) => {
        if (!src) return false;
        const lower = src.toLowerCase();
        if (lower.startsWith('data:image')) return false;
        // Only exclude obvious non-athlete images
        return !lower.includes('placeholder') &&
               !lower.includes('default-avatar') &&
               !lower.includes('team-logo') &&
               !lower.includes('conference-logo');
      };

      // Check all images, very lenient criteria
      const allImages = Array.from(document.querySelectorAll('img'));

      const candidates = allImages
        .map(img => ({
          src: img.src,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
          alt: img.alt || '',
          class: img.className || ''
        }))
        .filter(img => {
          if (!isValidHeadshot(img.src)) return false;

          // Must have some dimensions
          if (img.width < 50 || img.height < 50) return false;

          // Exclude obvious logos by checking if "logo" appears in src/alt/class
          const combined = (img.src + img.alt + img.class).toLowerCase();
          if (combined.includes('logo') && !combined.includes('headshot') && !combined.includes('bio')) {
            return false;
          }

          return true;
        })
        .map(img => ({
          ...img,
          aspectRatio: img.width / img.height,
          area: img.width * img.height
        }))
        .filter(img => {
          // Accept wider range of aspect ratios (portrait-ish to square-ish)
          return img.aspectRatio >= 0.4 && img.aspectRatio <= 1.2;
        })
        .sort((a, b) => {
          // Prefer portrait orientation
          const idealRatio = 0.66;
          const aDiff = Math.abs(a.aspectRatio - idealRatio);
          const bDiff = Math.abs(b.aspectRatio - idealRatio);

          if (Math.abs(aDiff - bDiff) < 0.15) {
            // Similar aspect ratio, prefer larger
            return b.area - a.area;
          }

          return aDiff - bDiff;
        });

      return candidates[0]?.src || null;
    });

    return photoUrl;
  } catch (error) {
    console.log(`    ⚠️  Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n📸 SCRAPING: Any athlete photos (lenient mode)\n');

  const teamNames = ['LSU', 'North Carolina', 'Purdue'];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const teamName of teamNames) {
    console.log(`${'='.repeat(70)}`);
    console.log(`TEAM: ${teamName}`);
    console.log('='.repeat(70));

    const { data: team } = await supabase
      .from('teams')
      .select('id, logo_url')
      .eq('name', teamName)
      .single();

    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url, profile_url')
      .eq('team_id', team.id)
      .order('name');

    console.log(`Processing ${athletes.length} athletes\n`);

    let found = 0;
    let skipped = 0;

    // Process first 5 athletes as test
    for (const athlete of athletes.slice(0, 5)) {
      console.log(`${athlete.name}:`);

      if (!athlete.profile_url) {
        console.log(`  ⚠️  No profile URL - skipping`);
        skipped++;
        continue;
      }

      const photoUrl = await scrapeAnyPhoto(page, athlete.profile_url, athlete.name);

      if (photoUrl) {
        console.log(`  ✅ Found: ${photoUrl}`);
        found++;
      } else {
        console.log(`  ❌ No photo found`);
      }
    }

    console.log(`\n${teamName} Results: ${found}/5 found (test sample)\n`);
  }

  await browser.close();

  console.log('\n✅ Test complete - review results above');
}

main();
