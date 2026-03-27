require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CORNELL_LOGO = 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/cornellbigred.com/images/responsive_2025/logo_main.svg';

const BROKEN_URL_PATTERNS = [
  'securepubads.g.doubleclick.net',
  'ad_counter.aspx',
  '/sports/mens-swimming-and-diving/roster',
  '/sports/sd/roster',
];

function isBrokenUrl(url) {
  if (!url) return true;
  return BROKEN_URL_PATTERNS.some(pattern => url.includes(pattern));
}

async function scrapeAthletePhoto(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      // Find the main bio/headshot image
      const selectors = [
        'img.roster-bio-photo__image',
        'img.sidearm-roster-player-image',
        '.roster-bio-photo img',
        '.roster-player-image img',
        'img[class*="headshot"]',
      ];

      for (const sel of selectors) {
        const img = document.querySelector(sel);
        if (img?.src && !img.src.includes('placeholder') && !img.src.includes('logo')) {
          return img.src;
        }
      }

      // Fall back to largest portrait image from cornellbigred.com
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || '';
          if (!src.includes('cornellbigred.com') && !src.includes('cloudfront.net')) return false;
          if (src.includes('logo') || src.includes('placeholder')) return false;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w < 80 || h < 80) return false;
          const ratio = w / h;
          return ratio >= 0.4 && ratio <= 1.0;
        })
        .map(img => ({
          src: img.src,
          area: (img.naturalWidth || img.width) * (img.naturalHeight || img.height)
        }))
        .sort((a, b) => b.area - a.area);

      return candidates[0]?.src || null;
    });

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING: Cornell Logo + Headshots\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Cornell')
    .single();

  // Step 1: Fix the logo
  console.log('Step 1: Updating Cornell logo...');
  await supabase
    .from('teams')
    .update({ logo_url: CORNELL_LOGO })
    .eq('id', team.id);
  console.log(`✅ Logo updated to: ${CORNELL_LOGO}\n`);

  // Step 2: Fix broken headshots
  console.log('Step 2: Fixing broken headshots...\n');

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id)
    .order('name');

  const brokenAthletes = athletes.filter(a => isBrokenUrl(a.photo_url));
  const goodAthletes = athletes.filter(a => !isBrokenUrl(a.photo_url));

  console.log(`Good URLs: ${goodAthletes.length}`);
  console.log(`Broken URLs: ${brokenAthletes.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let fixed = 0;

  for (const athlete of brokenAthletes) {
    console.log(`${athlete.name}:`);

    if (!athlete.profile_url) {
      console.log(`  ⚠️  No profile URL - setting team logo`);
      await supabase.from('athletes').update({ photo_url: CORNELL_LOGO }).eq('id', athlete.id);
      continue;
    }

    const photoUrl = await scrapeAthletePhoto(page, athlete.profile_url);

    if (photoUrl) {
      let finalUrl = photoUrl;
      if (photoUrl.includes('?width=') || photoUrl.includes('&width=')) {
        try {
          const url = new URL(photoUrl);
          url.searchParams.set('width', '1920');
          url.searchParams.set('height', '1920');
          finalUrl = url.toString();
        } catch {}
      }

      console.log(`  ✅ Found: ${finalUrl.substring(0, 70)}...`);
      await supabase.from('athletes').update({ photo_url: finalUrl }).eq('id', athlete.id);
      fixed++;
    } else {
      console.log(`  ❌ No photo found - setting team logo`);
      await supabase.from('athletes').update({ photo_url: CORNELL_LOGO }).eq('id', athlete.id);
    }
  }

  // Also fix William Klingensmith who has Will Chen's photo
  const klingensmith = athletes.find(a => a.name === 'William Klingensmith');
  const chen = athletes.find(a => a.name === 'Will Chen');
  if (klingensmith && chen && klingensmith.photo_url === chen.photo_url) {
    console.log(`\nWilliam Klingensmith: Has Will Chen's photo - rescraping...`);
    if (klingensmith.profile_url) {
      const photoUrl = await scrapeAthletePhoto(page, klingensmith.profile_url);
      if (photoUrl) {
        console.log(`  ✅ Found: ${photoUrl.substring(0, 70)}...`);
        await supabase.from('athletes').update({ photo_url: photoUrl }).eq('id', klingensmith.id);
      } else {
        console.log(`  ❌ No photo found - setting team logo`);
        await supabase.from('athletes').update({ photo_url: CORNELL_LOGO }).eq('id', klingensmith.id);
      }
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Broken URLs fixed by rescraping: ${fixed}`);
  console.log(`Set to team logo: ${brokenAthletes.length - fixed}`);
}

main();
