require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAthletePage(page, athleteName) {
  const slug = athleteName.toLowerCase().replace(/\s+/g, '-');
  const url = `https://lsusports.net/sports/sd/roster/player/${slug}/`;

  console.log(`\nVisiting: ${url}\n`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(4000);

  const pageInfo = await page.evaluate(() => {
    const allImages = Array.from(document.querySelectorAll('img'));

    return {
      totalImages: allImages.length,
      images: allImages.map(img => ({
        src: img.src,
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
        alt: img.alt || '',
        className: img.className || '',
        aspectRatio: ((img.naturalWidth || img.width) / (img.naturalHeight || img.height)).toFixed(2)
      }))
    };
  });

  console.log(`Total images: ${pageInfo.totalImages}\n`);

  pageInfo.images.forEach((img, i) => {
    console.log(`Image ${i + 1}:`);
    console.log(`  Size: ${img.width}x${img.height} (ratio: ${img.aspectRatio})`);
    console.log(`  Alt: ${img.alt}`);
    console.log(`  Class: ${img.className}`);
    console.log(`  URL: ${img.src.substring(0, 100)}...`);
    console.log();
  });
}

async function main() {
  console.log('🔍 Debugging LSU Athlete Page\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'LSU')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name')
    .eq('team_id', team.id)
    .limit(3);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const athlete of athletes) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`ATHLETE: ${athlete.name}`);
    console.log('='.repeat(70));
    await debugAthletePage(page, athlete.name);
  }

  await browser.close();
}

main().catch(console.error);
