require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeAthleteHeadshot(page, athleteUrl, athleteName) {
  try {
    await page.goto(athleteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const photoUrl = await page.evaluate((name) => {
      const isValidHeadshot = (src) => {
        if (!src) return false;
        const lower = src.toLowerCase();
        if (lower.startsWith('data:image')) return false;
        return !lower.includes('placeholder') &&
               !lower.includes('default') &&
               !lower.includes('logo') &&
               !lower.includes('team-logo') &&
               !lower.includes('headshot_generic') &&
               !lower.includes('silhouette');
      };

      const isPortraitOrientation = (img) => {
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        if (width === 0 || height === 0) return false;
        const aspectRatio = width / height;
        return aspectRatio >= 0.5 && aspectRatio <= 0.8;
      };

      const upgradeQuality = (src) => {
        if (src.includes('sidearmdev.com')) {
          let url = src.split('&width=')[0].split('&height=')[0].split('?width=')[0].split('?height=')[0];
          if (url.includes('?')) {
            url += '&width=600&height=900';
          } else {
            url += '?width=600&height=900';
          }
          return url;
        }
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
        'dxbhsrqyrr690.cloudfront.net',
        'storage.googleapis.com',
        'imgproxy',
        '12thman.com',
      ];

      const portraitHeadshots = [];
      const allImages = document.querySelectorAll('img');

      for (const img of allImages) {
        const src = img.src;
        if (!isValidHeadshot(src)) continue;
        if (!athleticDomains.some(domain => src.includes(domain))) continue;

        if (isPortraitOrientation(img)) {
          const width = img.naturalWidth || img.width || 0;
          const height = img.naturalHeight || img.height || 0;
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
        portraitHeadshots.sort((a, b) => {
          if (a.isRosterPath && !b.isRosterPath) return -1;
          if (!a.isRosterPath && b.isRosterPath) return 1;

          const idealRatio = 0.66;
          const aDiff = Math.abs(a.aspectRatio - idealRatio);
          const bDiff = Math.abs(b.aspectRatio - idealRatio);

          if (Math.abs(aDiff - bDiff) < 0.1) {
            return b.area - a.area;
          }
          return aDiff - bDiff;
        });

        return upgradeQuality(portraitHeadshots[0].src);
      }

      return null;
    }, athleteName);

    return photoUrl;
  } catch (error) {
    console.error(`    Error scraping ${athleteName}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING TEXAS A&M HEADSHOTS');
  console.log('Using correct roster URL: /sports/swimdive/roster\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get Texas A&M team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Texas A&M')
    .single();

  if (!team) {
    console.log('❌ Texas A&M team not found');
    await browser.close();
    return;
  }

  // Get Texas A&M athletes (all should be men from original scrape)
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} Texas A&M athletes in database\n`);

  // Get roster links from correct URL
  await page.goto('https://12thman.com/sports/swimdive/roster', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(3000);

  const rosterLinks = await page.evaluate(() => {
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
  });

  console.log(`Found ${rosterLinks.length} athletes on roster page (men & women)\n`);

  let updated = 0;

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

        console.log(`    ✅ Updated with headshot`);
        updated++;
      } else {
        await supabase
          .from('athletes')
          .update({
            profile_url: match.url,
          })
          .eq('id', athlete.id);

        console.log(`    ⚠️  No headshot found, updated profile URL`);
      }
    } else {
      console.log(`  ⚠️  Not found on roster: ${athlete.name}`);
    }

    await page.waitForTimeout(500);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ TEXAS A&M HEADSHOT FIX COMPLETE');
  console.log('='.repeat(70));
  console.log(`Updated: ${updated}/${athletes.length} Texas A&M athletes\n`);
}

main();
