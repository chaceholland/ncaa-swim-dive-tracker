require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Only Auburn and South Carolina
const teamUrls = {
  'Auburn': 'https://auburntigers.com/sports/swimming-diving/roster',
  'South Carolina': 'https://gamecocksonline.com/sports/swimming/roster/',
};

async function scrapeAthletePhoto(page, athleteUrl, athleteName) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Wait longer for lazy-loaded images
    await page.waitForTimeout(3000);

    const photoUrl = await page.evaluate((name) => {
      const isValidHeadshot = (src) => {
        if (!src) return false;
        const lower = src.toLowerCase();
        // Reject data URIs (base64 placeholders)
        if (lower.startsWith('data:image')) return false;
        return !lower.includes('placeholder') &&
               !lower.includes('default') &&
               !lower.includes('logo') &&
               !lower.includes('team-logo') &&
               !lower.includes('headshot_generic') &&
               !lower.includes('silhouette');
      };

      const upgradeQuality = (src) => {
        if (src.includes('width=') || src.includes('height=')) {
          src = src.replace(/width=\d+/, 'width=1200');
          src = src.replace(/height=\d+/, 'height=1200');
        }
        return src;
      };

      // Strategy 1: Try specific CSS selectors
      const selectors = [
        'img.sidearm-roster-player-image',
        'img.roster-bio-photo__image',
        '.s-person-card__photo img',
        '.roster-photo img',
        'img[itemprop="image"]',
        'picture img',
        '.player-image img',
        '.s-person-details__media img',
        '.roster-player-hero-image__image', // Auburn specific
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src && isValidHeadshot(img.src)) {
          return upgradeQuality(img.src);
        }
      }

      // Strategy 2: Find by alt text matching athlete name
      if (name) {
        const nameParts = name.toLowerCase().split(' ');
        const allImages = document.querySelectorAll('img');

        for (const img of allImages) {
          const alt = (img.alt || '').toLowerCase();
          const src = img.src;

          if (alt && nameParts.some(part => alt.includes(part)) && isValidHeadshot(src)) {
            if (src.includes('sidearmdev.com') ||
                src.includes('sidearm.sites') ||
                src.includes('cloudfront') ||
                src.includes('athletic') ||
                src.includes('roster') ||
                src.includes('imgproxy') ||
                src.includes('gamecocksonline') ||
                src.includes('auburntigers') ||
                src.includes('headshot')) {
              return upgradeQuality(src);
            }
          }
        }
      }

      // Strategy 3: Find images from known athletic photo domains (prioritize largest)
      const athleticDomains = [
        'sidearmdev.com',
        'sidearm.sites',
        'cloudfront.net',
        'imgproxy',
        'gamecocksonline.com',
        'lsusports.net',
        '12thman.com',
        'auburntigers.com/imgproxy'
      ];

      const allImages = document.querySelectorAll('img');
      const validImages = [];

      for (const img of allImages) {
        const src = img.src;
        if (isValidHeadshot(src) && athleticDomains.some(domain => src.includes(domain))) {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          if (width >= 100 && height >= 100) {
            validImages.push({ src, width, height });
          }
        }
      }

      // Return the largest valid image (likely the main headshot)
      if (validImages.length > 0) {
        validImages.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        return upgradeQuality(validImages[0].src);
      }

      return null;
    }, athleteName);

    return photoUrl;
  } catch (error) {
    return null;
  }
}

async function rescrapeTeam(browser, teamName, rosterUrl) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Processing: ${teamName}`);
  console.log('='.repeat(70));

  const page = await browser.newPage();

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`⚠️  ${teamName} team not found`);
    await page.close();
    return { updated: 0, photos: 0 };
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, profile_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} athletes in database`);

  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const rosterLinks = await page.evaluate((teamName) => {
      const links = [];

      document.querySelectorAll('a[href*="/roster/"]').forEach(link => {
        const href = link.href;
        const name = link.textContent.trim();

        if (name &&
            name.length > 2 &&
            name.length < 50 &&
            !name.includes('Full Bio') &&
            !href.includes('/coaches/') &&
            !href.includes('/staff/')) {
          links.push({ name, url: href });
        }
      });

      const unique = [];
      const seen = new Set();
      links.forEach(l => {
        if (!seen.has(l.url)) {
          seen.add(l.url);
          unique.push(l);
        }
      });

      return unique;
    }, teamName);

    console.log(`Found ${rosterLinks.length} athletes on roster page\n`);

    let updated = 0;
    let photosFound = 0;

    for (const athlete of athletes) {
      const match = rosterLinks.find(r => r.name === athlete.name);

      if (match) {
        console.log(`  Processing: ${athlete.name}`);

        const photoUrl = await scrapeAthletePhoto(page, match.url, athlete.name);

        if (photoUrl) {
          await supabase
            .from('athletes')
            .update({
              profile_url: match.url,
              photo_url: photoUrl,
            })
            .eq('id', athlete.id);

          console.log(`    ✅ Updated with headshot`);
          photosFound++;
          updated++;
        } else {
          await supabase
            .from('athletes')
            .update({
              profile_url: match.url,
            })
            .eq('id', athlete.id);

          console.log(`    ⚠️  No photo found, keeping logo`);
          updated++;
        }
      } else {
        console.log(`  ⚠️  Not found on roster: ${athlete.name}`);
      }

      await page.waitForTimeout(500);
    }

    console.log(`\n${teamName} Summary: ${updated}/${athletes.length} updated, ${photosFound} headshots`);
    await page.close();
    return { updated, photos: photosFound };

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await page.close();
    return { updated: 0, photos: 0 };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  console.log('\n🔄 FIXING AUBURN & SOUTH CAROLINA HEADSHOTS');
  console.log('Re-scraping with improved lazy-load handling...\n');

  const results = {};
  for (const [teamName, rosterUrl] of Object.entries(teamUrls)) {
    results[teamName] = await rescrapeTeam(browser, teamName, rosterUrl);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ RESCRAPE COMPLETE');
  console.log('='.repeat(70));

  let totalUpdated = 0;
  let totalPhotos = 0;
  Object.entries(results).forEach(([team, stats]) => {
    console.log(`${team}: ${stats.updated} athletes, ${stats.photos} headshots`);
    totalUpdated += stats.updated;
    totalPhotos += stats.photos;
  });

  console.log(`\nTotal: ${totalUpdated} athletes updated, ${totalPhotos} headshots found`);
}

main();
