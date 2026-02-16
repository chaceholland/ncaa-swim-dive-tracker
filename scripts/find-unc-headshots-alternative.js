require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Try searching Google Images or the UNC athletics site differently
async function findAthletePhoto(page, athleteName) {
  try {
    // Try the main athletics site images directory
    const searchUrl = `https://goheels.com/images/2024/9/10/${athleteName.toLowerCase().replace(/\s+/g, '_')}.jpg`;
    
    // Also try roster photos directory
    const patterns = [
      `https://goheels.com/images/2024/9/10/${athleteName.toLowerCase().replace(/\s+/g, '_')}.jpg`,
      `https://goheels.com/images/2023/9/10/${athleteName.toLowerCase().replace(/\s+/g, '_')}.jpg`,
      `https://d141rwalb2fvgk.cloudfront.net/images/2024/9/10/${athleteName.toLowerCase().replace(/\s+/g, '_')}.jpg`,
    ];

    for (const url of patterns) {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
      if (response && response.status() === 200) {
        return url;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('\n🔍 SEARCHING: Alternative sources for UNC headshots\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'North Carolina')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .eq('photo_url', team.logo_url);

  console.log(`Found ${athletes.length} athletes using team logo\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const athlete of athletes.slice(0, 3)) {
    console.log(`${athlete.name}:`);
    const photoUrl = await findAthletePhoto(page, athlete.name);
    
    if (photoUrl) {
      console.log(`  ✅ Found: ${photoUrl}\n`);
    } else {
      console.log(`  ⚠️  Not found via URL patterns\n`);
    }
  }

  await browser.close();
}

main();
