require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Roster URLs for ACC teams
const ROSTER_URLS = {
  'SMU': 'https://smumustangs.com/sports/mens-swimming-and-diving/roster',
  'Cal': 'https://calbears.com/sports/mens-swimming-and-diving/roster',
  'Stanford': 'https://gostanford.com/sports/mens-swimming-and-diving/roster',
  'Georgia Tech': 'https://ramblinwreck.com/sports/mens-swimming-and-diving/roster',
  'Notre Dame': 'https://und.com/sports/mens-swimming-and-diving/roster',
  'Duke': 'https://goduke.com/sports/mens-swimming-and-diving/roster',
  'North Carolina': 'https://goheels.com/sports/mens-swimming-and-diving/roster',
  'NC State': 'https://gopack.com/sports/mens-swimming-and-diving/roster',
  'Florida State': 'https://seminoles.com/sports/mens-swimming-and-diving/roster',
  'Pittsburgh': 'https://pittsburghpanthers.com/sports/mens-swimming-and-diving/roster',
  'Boston College': 'https://bceagles.com/sports/mens-swimming-and-diving/roster'
};

function decodeImgproxyUrl(imgproxyUrl) {
  const match = imgproxyUrl.match(/\/([^\/]+)\.(jpg|png|webp)$/);
  if (!match) return null;

  try {
    const base64Url = match[1];
    const originalUrl = Buffer.from(base64Url, 'base64').toString('utf-8');
    
    if (originalUrl.includes('storage.googleapis.com')) {
      return originalUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function scrapeRosterPage(page, rosterUrl) {
  console.log(`  Navigating to: ${rosterUrl}`);
  
  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const athletes = await page.evaluate(() => {
      const results = [];
      
      // Look for roster items (common pattern across Sidearm sites)
      const rosterItems = document.querySelectorAll('.s-person-card, .roster-card, [class*="roster"] [class*="card"]');
      
      for (const item of rosterItems) {
        // Get name
        const nameEl = item.querySelector('.s-person-card__name, .s-person-details__personal-single-line, h3, .name, [class*="name"]');
        const name = nameEl?.textContent?.trim();
        
        if (!name) continue;
        
        // Get photo - try multiple patterns
        let photoUrl = null;
        
        // Pattern 1: img with url attribute (lazy load)
        const lazyImg = item.querySelector('img[url]');
        if (lazyImg) {
          photoUrl = lazyImg.getAttribute('url');
        }
        
        // Pattern 2: regular img src
        if (!photoUrl) {
          const img = item.querySelector('img');
          if (img && img.src && !img.src.startsWith('data:')) {
            photoUrl = img.src;
          }
        }
        
        // Pattern 3: background image
        if (!photoUrl) {
          const bgEl = item.querySelector('[style*="background-image"]');
          if (bgEl) {
            const style = bgEl.getAttribute('style');
            const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match) photoUrl = match[1];
          }
        }
        
        if (name && photoUrl && !photoUrl.includes('logo') && !photoUrl.includes('placeholder')) {
          results.push({ name, photoUrl });
        }
      }
      
      return results;
    });

    console.log(`  Found ${athletes.length} athletes on roster page`);
    return athletes;
    
  } catch (error) {
    console.log(`  ❌ Error scraping: ${error.message}`);
    return [];
  }
}

async function fixTeam(teamName, browser) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FIXING: ${teamName}`);
  console.log('='.repeat(70));

  const rosterUrl = ROSTER_URLS[teamName];
  if (!rosterUrl) {
    console.log(`  ⚠️  No roster URL configured`);
    return;
  }

  // Get team from database
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`  ❌ Team not found in database`);
    return;
  }

  // Get athletes that need fixing (have logos or NULL)
  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id);

  const needsFixing = dbAthletes.filter(a => 
    !a.photo_url || 
    a.photo_url.includes('logo') || 
    a.photo_url.includes('header_logo') ||
    a.photo_url.startsWith('data:image')
  );

  console.log(`\n${needsFixing.length}/${dbAthletes.length} athletes need fixing`);

  if (needsFixing.length === 0) {
    console.log(`  ✅ All athletes already have headshots`);
    return;
  }

  // Scrape roster page
  const page = await browser.newPage();
  const scrapedAthletes = await scrapeRosterPage(page, rosterUrl);
  await page.close();

  if (scrapedAthletes.length === 0) {
    console.log(`  ⚠️  No athletes scraped from roster page`);
    return;
  }

  // Match and update
  let updated = 0;
  let withHeadshot = 0;
  let withLogo = 0;

  for (const dbAthlete of needsFixing) {
    console.log(`\n  ${dbAthlete.name}:`);
    
    // Try to find matching athlete from roster
    const scraped = scrapedAthletes.find(s => 
      s.name.toLowerCase().includes(dbAthlete.name.toLowerCase()) ||
      dbAthlete.name.toLowerCase().includes(s.name.toLowerCase())
    );

    let finalPhotoUrl = null;

    if (scraped) {
      // Decode imgproxy if needed
      if (scraped.photoUrl.includes('imgproxy')) {
        const decoded = decodeImgproxyUrl(scraped.photoUrl);
        finalPhotoUrl = decoded || scraped.photoUrl;
        console.log(`    Found headshot (imgproxy decoded)`);
      } else {
        finalPhotoUrl = scraped.photoUrl;
        console.log(`    Found headshot`);
      }
      withHeadshot++;
    } else {
      finalPhotoUrl = team.logo_url;
      console.log(`    No match - using team logo`);
      withLogo++;
    }

    await supabase
      .from('athletes')
      .update({ photo_url: finalPhotoUrl })
      .eq('id', dbAthlete.id);

    updated++;
  }

  console.log(`\n✅ ${teamName}: ${updated} updated (${withHeadshot} headshots, ${withLogo} logos)`);
}

async function main() {
  console.log('\n🔧 FIXING ACC TEAMS');
  console.log('Scraping roster pages for athlete headshots...\n');

  const browser = await chromium.launch({ headless: true });

  // Fix teams in order of priority
  const teams = ['SMU', 'Cal', 'Stanford', 'Georgia Tech', 'Notre Dame', 'Duke', 'North Carolina', 'NC State', 'Florida State', 'Pittsburgh', 'Boston College'];

  for (const team of teams) {
    await fixTeam(team, browser);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ ACC TEAMS FIX COMPLETE');
  console.log('='.repeat(70));
}

main();
