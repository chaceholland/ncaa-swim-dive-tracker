require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function trySwimSwam(page, athleteName, teamName) {
  try {
    const searchQuery = `${athleteName} ${teamName} swimming`;
    const searchUrl = `https://swimswam.com/?s=${encodeURIComponent(searchQuery)}`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);

    // Look for athlete profile link in search results
    const profileLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="swimswam.com"]'));
      for (const link of links) {
        const text = link.textContent.toLowerCase();
        if (text && !text.includes('video') && !text.includes('watch')) {
          return link.href;
        }
      }
      return null;
    });

    if (!profileLink) return null;

    await page.goto(profileLink, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1000);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.src || '';
        if (src && !src.includes('logo') && !src.includes('ad') &&
            !src.includes('icon') && (src.includes('.jpg') || src.includes('.png'))) {
          return src;
        }
      }
      return null;
    });

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function tryUSASwimming(page, athleteName) {
  try {
    const searchUrl = `https://www.usaswimming.org/search?q=${encodeURIComponent(athleteName)}`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.src || '';
        const alt = img.alt || '';
        if (src && !src.includes('logo') && !src.includes('icon') &&
            (alt.toLowerCase().includes('athlete') || alt.toLowerCase().includes('swimmer'))) {
          return src;
        }
      }
      return null;
    });

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function tryCollegeSwimming(page, athleteName, teamName) {
  try {
    // College Swimming & Diving database
    const searchUrl = `https://www.collegeswimming.com/swimmer/${athleteName.toLowerCase().replace(/\s+/g, '-')}/`;
    
    const response = await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    if (!response || response.status() !== 200) return null;

    await page.waitForTimeout(1000);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.src || '';
        if (src && !src.includes('logo') && (src.includes('athlete') || src.includes('swimmer'))) {
          return src;
        }
      }
      return null;
    });

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function findAthletePhoto(page, athleteName, teamName) {
  console.log(`  Trying SwimSwam...`);
  let photoUrl = await trySwimSwam(page, athleteName, teamName);
  if (photoUrl) return { source: 'SwimSwam', url: photoUrl };

  console.log(`  Trying USA Swimming...`);
  photoUrl = await tryUSASwimming(page, athleteName);
  if (photoUrl) return { source: 'USA Swimming', url: photoUrl };

  console.log(`  Trying CollegeSwimming.com...`);
  photoUrl = await tryCollegeSwimming(page, athleteName, teamName);
  if (photoUrl) return { source: 'CollegeSwimming', url: photoUrl };

  return null;
}

async function main() {
  console.log('\n🔍 SCRAPING: Alternative sources for athlete headshots\n');

  const missingData = require('../missing-headshots.json');
  
  // Start with teams that have the most missing
  const priorityTeams = missingData.slice(0, 5); // Top 5 teams

  console.log(`Processing top 5 teams:\n`);
  priorityTeams.forEach(t => console.log(`  - ${t.name}: ${t.missing} athletes`));
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let totalFound = 0;
  let totalProcessed = 0;

  for (const teamData of priorityTeams) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEAM: ${teamData.name}`);
    console.log('='.repeat(70));

    const { data: team } = await supabase
      .from('teams')
      .select('id, logo_url')
      .eq('name', teamData.name)
      .single();

    // Process first 3 athletes per team as a test
    const testAthletes = teamData.athletes.slice(0, 3);

    for (const athleteName of testAthletes) {
      console.log(`\n${athleteName}:`);
      totalProcessed++;

      const result = await findAthletePhoto(page, athleteName, teamData.name);

      if (result) {
        console.log(`  ✅ Found via ${result.source}: ${result.url.substring(0, 60)}...`);

        // Get athlete ID
        const { data: athlete } = await supabase
          .from('athletes')
          .select('id')
          .eq('team_id', team.id)
          .ilike('name', athleteName)
          .single();

        if (athlete) {
          await supabase
            .from('athletes')
            .update({ photo_url: result.url })
            .eq('id', athlete.id);
          
          totalFound++;
        }
      } else {
        console.log(`  ⚠️  Not found in any source`);
      }
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Processed: ${totalProcessed} athletes`);
  console.log(`Found: ${totalFound} headshots`);
  console.log(`Success rate: ${((totalFound/totalProcessed)*100).toFixed(1)}%`);
}

main();
