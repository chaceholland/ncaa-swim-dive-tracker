require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Try constructing URLs manually
const urlPatterns = [
  (name) => `https://goheels.com/sports/mens-swimming-and-diving/roster/${name.toLowerCase().replace(/\s+/g, '-')}`,
  (name) => `https://goheels.com/sports/swimming-and-diving/roster/${name.toLowerCase().replace(/\s+/g, '-')}`,
];

async function scrapeAthleteProfile(page, profileUrl) {
  try {
    const response = await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    if (!response || response.status() === 404) {
      return { found: false, photoUrl: null };
    }

    await page.waitForTimeout(1000);

    const photoUrl = await page.evaluate(() => {
      const lazyImages = document.querySelectorAll('img[url]');
      for (const img of lazyImages) {
        const url = img.getAttribute('url');
        if (url && !url.includes('logo')) {
          return url;
        }
      }

      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.src || '';
        if (src && !src.startsWith('data:') && 
            !src.includes('logo') && !src.includes('nav') &&
            (src.includes('.jpg') || src.includes('.png'))) {
          return src;
        }
      }
      return null;
    });

    if (photoUrl && photoUrl.includes('?width=')) {
      const url = new URL(photoUrl);
      url.searchParams.set('width', '1920');
      url.searchParams.set('height', '1920');
      return { found: true, photoUrl: url.toString() };
    }

    return { found: !!photoUrl, photoUrl };
  } catch (error) {
    return { found: false, photoUrl: null };
  }
}

async function main() {
  console.log('\n🔧 MANUAL FIX: North Carolina\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'North Carolina')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%supabase.co/storage%');

  console.log(`Found ${athletes.length} athletes with Supabase uploads\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let upgraded = 0;

  for (const athlete of athletes) {
    console.log(`${athlete.name}:`);
    
    let found = false;
    for (const pattern of urlPatterns) {
      const testUrl = pattern(athlete.name);
      console.log(`  Testing: ${testUrl}`);
      
      const result = await scrapeAthleteProfile(page, testUrl);
      
      if (result.found && result.photoUrl) {
        await supabase
          .from('athletes')
          .update({ photo_url: result.photoUrl })
          .eq('id', athlete.id);
        
        console.log(`  ✅ Found and upgraded\n`);
        upgraded++;
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log(`  ⚠️  No profile found\n`);
    }
  }

  await browser.close();

  console.log(`\n✅ Complete: ${upgraded}/${athletes.length} upgraded`);
}

main();
