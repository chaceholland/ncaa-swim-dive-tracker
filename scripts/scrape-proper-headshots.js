require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const teamUrls = {
  'Alabama': 'https://rolltide.com/sports/swimming-and-diving/roster',
  'Auburn': 'https://auburntigers.com/sports/swimming-diving/roster',
  'Florida': 'https://floridagators.com/sports/mens-swimming-and-diving/roster',
  'Georgia': 'https://georgiadogs.com/sports/msd/roster',
  'Kentucky': 'https://ukathletics.com/sports/swimming/roster/',
  'LSU': 'https://lsusports.net/sports/sd/roster/',
  'Missouri': 'https://mutigers.com/sports/swimming-and-diving/roster',
  'South Carolina': 'https://gamecocksonline.com/sports/swimming/roster/',
  'Tennessee': 'https://utsports.com/sports/mens-swimming-and-diving/roster',
  'Texas A&M': 'https://12thman.com/sports/swimdive/roster'
};

async function scrapeAthleteHeadshot(page, athleteUrl, athleteName) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const photoUrl = await page.evaluate((name) => {
      const isValidHeadshot = (src) => {
        if (!src) return false;
        const lower = src.toLowerCase();

        // Reject invalid sources
        if (lower.startsWith('data:image')) return false;
        if (lower.includes('placeholder')) return false;
        if (lower.includes('default')) return false;
        if (lower.includes('logo')) return false;
        if (lower.includes('team-logo')) return false;
        if (lower.includes('headshot_generic')) return false;
        if (lower.includes('silhouette')) return false;

        return true;
      };

      const isPortraitOrientation = (img) => {
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        if (width === 0 || height === 0) return false;

        // Portrait images are taller than wide (aspect ratio < 1)
        // Typical headshots are around 2:3 ratio (0.66)
        const aspectRatio = width / height;
        return aspectRatio >= 0.5 && aspectRatio <= 0.8;
      };

      const upgradeQuality = (src) => {
        // For sidearmdev.com images, request higher quality
        if (src.includes('sidearmdev.com')) {
          // Remove existing size params and add high-quality ones
          let url = src.split('&width=')[0].split('&height=')[0].split('?width=')[0].split('?height=')[0];

          // Add high quality parameters
          if (url.includes('?')) {
            url += '&width=600&height=900';
          } else {
            url += '?width=600&height=900';
          }
          return url;
        }

        // For other imgproxy services
        if (src.includes('width=') || src.includes('height=')) {
          src = src.replace(/width=\d+/, 'width=1200');
          src = src.replace(/height=\d+/, 'height=1200');
        }

        return src;
      };

      // PRIORITY 1: Look for specific roster/bio photo selectors
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
          return upgradeQuality(img.src);
        }
      }

      // PRIORITY 2: Find images with portrait orientation from athletic domains
      const athleticDomains = [
        'sidearmdev.com',
        'sidearm.sites',
        'dxbhsrqyrr690.cloudfront.net', // Georgia's CDN
        'storage.googleapis.com',
        'imgproxy',
      ];

      const portraitHeadshots = [];
      const allImages = document.querySelectorAll('img');

      for (const img of allImages) {
        const src = img.src;

        if (!isValidHeadshot(src)) continue;
        if (!athleticDomains.some(domain => src.includes(domain))) continue;

        // Check if it's portrait orientation (headshot-like)
        if (isPortraitOrientation(img)) {
          const width = img.naturalWidth || img.width || 0;
          const height = img.naturalHeight || img.height || 0;

          // Prioritize images from /images/ paths (usually roster photos)
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
        // Sort by: roster path first, then by size
        portraitHeadshots.sort((a, b) => {
          if (a.isRosterPath && !b.isRosterPath) return -1;
          if (!a.isRosterPath && b.isRosterPath) return 1;

          // Prefer typical headshot aspect ratios (around 0.66)
          const idealRatio = 0.66;
          const aDiff = Math.abs(a.aspectRatio - idealRatio);
          const bDiff = Math.abs(b.aspectRatio - idealRatio);

          if (Math.abs(aDiff - bDiff) < 0.1) {
            // If aspect ratios are similar, prefer larger size
            return b.area - a.area;
          }

          // Otherwise prefer better aspect ratio
          return aDiff - bDiff;
        });

        return upgradeQuality(portraitHeadshots[0].src);
      }

      // PRIORITY 3: Try matching by alt text with athlete name
      if (name) {
        const nameParts = name.toLowerCase().split(' ');

        for (const img of allImages) {
          const alt = (img.alt || '').toLowerCase();
          const src = img.src;

          if (alt && nameParts.every(part => alt.includes(part)) &&
              isValidHeadshot(src) && isPortraitOrientation(img)) {
            if (athleticDomains.some(domain => src.includes(domain))) {
              return upgradeQuality(src);
            }
          }
        }
      }

      return null;
    }, athleteName);

    return photoUrl;
  } catch (error) {
    console.error(`    Error scraping ${athleteName}: ${error.message}`);
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

      if (teamName === 'LSU') {
        document.querySelectorAll('a[href*="/roster/player/"]').forEach(bioLink => {
          const urlParts = bioLink.href.split('/roster/player/')[1]?.split('/')[0];
          if (urlParts && !bioLink.href.includes('/coach')) {
            const name = urlParts.split('-').map(word =>
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            links.push({ name, url: bioLink.href });
          }
        });
      } else {
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
      }

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

        const photoUrl = await scrapeAthleteHeadshot(page, match.url, athlete.name);

        if (photoUrl) {
          await supabase
            .from('athletes')
            .update({
              profile_url: match.url,
              photo_url: photoUrl,
            })
            .eq('id', athlete.id);

          console.log(`    ✅ Updated with proper headshot`);
          photosFound++;
          updated++;
        } else {
          await supabase
            .from('athletes')
            .update({
              profile_url: match.url,
            })
            .eq('id', athlete.id);

          console.log(`    ⚠️  No headshot found, keeping current`);
          updated++;
        }
      } else {
        console.log(`  ⚠️  Not found on roster: ${athlete.name}`);
      }

      await page.waitForTimeout(500);
    }

    console.log(`\n${teamName} Summary: ${updated}/${athletes.length} updated, ${photosFound} proper headshots`);
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

  console.log('\n🎯 SCRAPING PROPER HEADSHOTS');
  console.log('Targeting portrait-oriented roster photos, not cover images...\n');

  const results = {};
  for (const [teamName, rosterUrl] of Object.entries(teamUrls)) {
    results[teamName] = await rescrapeTeam(browser, teamName, rosterUrl);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ HEADSHOT SCRAPING COMPLETE');
  console.log('='.repeat(70));

  let totalUpdated = 0;
  let totalPhotos = 0;
  Object.entries(results).forEach(([team, stats]) => {
    console.log(`${team}: ${stats.updated} athletes, ${stats.photos} proper headshots`);
    totalUpdated += stats.updated;
    totalPhotos += stats.photos;
  });

  console.log(`\nGrand Total: ${totalUpdated} athletes updated, ${totalPhotos} proper headshots found`);
}

main();
