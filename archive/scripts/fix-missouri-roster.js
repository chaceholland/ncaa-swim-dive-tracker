require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// The 22 men's athletes from Missouri's combined roster
const MISSOURI_MEN = [
  'Sebastian Gonzalez Barboza',
  'Conner Boatright',
  'Tanner Braunton',
  'Deacon Colbert',
  'Derek Colbert',
  'Griffin Craig',
  'Collier Dyer',
  'Ian Everett',
  'Quinlan Gould',
  'Brady Johnson',
  'Matthew Judkins',
  'Francois Malherbe',
  'Oliver Millán de Miguel',
  'Matthew Mortenson',
  'Luke Nebrich',
  'Logan Ottke',
  'Drew Ploof',
  'Jaden Pospishil',
  'Darden Tate',
  'Ethan Vance',
  'Tommaso Zannella',
  'Jan Zubik'
];

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
        'mutigers.com',
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
  console.log('\n🔧 FIXING MISSOURI ROSTER');
  console.log('Scraping all 22 men from combined roster...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get Missouri team
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Missouri')
    .single();

  if (!team) {
    console.log('❌ Missouri team not found');
    await browser.close();
    return;
  }

  // Get all roster links from Missouri's combined roster page
  await page.goto('https://mutigers.com/sports/swimming-and-diving/roster', {
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

  console.log(`Found ${rosterLinks.length} total athletes on roster page (men & women)\n`);

  // Filter to only the men's athletes
  const menLinks = rosterLinks.filter(link => MISSOURI_MEN.includes(link.name));
  console.log(`Filtered to ${menLinks.length} men's athletes\n`);

  let added = 0;
  let updated = 0;

  for (const link of menLinks) {
    console.log(`  Processing: ${link.name}`);

    // Check if athlete already exists
    const { data: existing } = await supabase
      .from('athletes')
      .select('id')
      .eq('team_id', team.id)
      .eq('name', link.name)
      .maybeSingle();

    const photoUrl = await scrapeAthleteHeadshot(page, link.url, link.name);

    if (existing) {
      // Update existing athlete
      await supabase
        .from('athletes')
        .update({
          profile_url: link.url,
          photo_url: photoUrl || team.logo_url,
        })
        .eq('id', existing.id);

      console.log(`    ✅ Updated existing athlete${photoUrl ? ' with headshot' : ''}`);
      updated++;
    } else {
      // Add new athlete
      await supabase
        .from('athletes')
        .insert({
          team_id: team.id,
          name: link.name,
          profile_url: link.url,
          photo_url: photoUrl || team.logo_url,
        });

      console.log(`    ✅ Added new athlete${photoUrl ? ' with headshot' : ''}`);
      added++;
    }

    await page.waitForTimeout(500);
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ MISSOURI ROSTER FIX COMPLETE');
  console.log('='.repeat(70));
  console.log(`Added: ${added} new athletes`);
  console.log(`Updated: ${updated} existing athletes`);
  console.log(`Total: ${added + updated}/${MISSOURI_MEN.length} men's athletes\n`);
}

main();
