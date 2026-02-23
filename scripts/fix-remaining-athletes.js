// Fix remaining athletes across multiple teams:
// - Cal: pixelated (add width param) + Trey Hesser (wrong photo) + Matthew Chai
// - Stanford: 5 athletes with ad-tracker photos
// - Ohio State: Michael Butler, Patrick Hemingway
// - Florida State: Aidan Siers
// - Arizona State: Caleb Liban
// - Columbia: Derrick Butts
// - Alabama: Paul Mathews, Peter Edin
// - Indiana: Aaron Shackell (no photo found)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Cal athletes that just need ?width=1920 added to existing calbears.com photo URLs
const CAL_PIXELATED = [
  'Caiden  Bowers', 'Jack Brown', 'Kenny Barnicle', 'Lars Antoniak',
  'Nikolas Antoniou', 'Lucca  Battaglini'
];

// Athletes that need roster-then-profile scrape
const ROSTER_SCRAPES = [
  {
    team: 'Stanford',
    rosterUrl: 'https://gostanford.com/sports/swimming-and-diving/roster',
    hostFilter: ['googleapis.com', 'gostanford.com/images/'],
    athletes: ['Henry McFadden', 'Henry Morrissey', 'Josh Zuchowski', 'Daniel Li', 'Ethan Harrington'],
  },
  {
    team: 'Ohio State',
    rosterUrl: 'https://ohiostatebuckeyes.com/sports/c-swim/roster/',
    hostFilter: ['ohiostatebuckeyes.com/images/', 'cloudfront.net'],
    athletes: ['Michael Butler', 'Patrick Hemingway'],
  },
  {
    team: 'Florida State',
    rosterUrl: 'https://seminoles.com/sports/mens-swimming-and-diving/roster',
    hostFilter: ['cloudfront.net', 'seminoles.com/images/'],
    athletes: ['Aidan Siers'],
  },
  {
    team: 'Arizona State',
    rosterUrl: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster',
    hostFilter: ['googleapis.com', 'thesundevils.com/images/'],
    athletes: ['Caleb Liban'],
  },
  {
    team: 'Columbia',
    rosterUrl: 'https://gocolumbialions.com/sports/mens-swimming-and-diving/roster',
    hostFilter: ['cloudfront.net', 'gocolumbialions.com/images/'],
    athletes: ['Derrick Butts'],
  },
  {
    team: 'Alabama',
    rosterUrl: 'https://rolltide.com/sports/swimming-and-diving/roster',
    hostFilter: ['cloudfront.net', 'rolltide.com/images/'],
    athletes: ['Paul Mathews', 'Peter Edin'],
  },
  {
    team: 'Cal',
    rosterUrl: 'https://calbears.com/sports/swimming-and-diving/roster',
    hostFilter: ['calbears.com/images/'],
    athletes: ['Trey  Hesser', 'Matthew Chai'],
  },
  {
    team: 'Indiana',
    rosterUrl: 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster',
    hostFilter: ['cloudfront.net', 'iuhoosiers.com/images/'],
    athletes: ['Aaron Shackell'],
  },
];

function buildPhotoFilter(hostFilter) {
  return `
    const images = Array.from(document.querySelectorAll('img'));
    const hosts = ${JSON.stringify(hostFilter)};
    const candidates = images
      .filter(img => {
        const src = img.src || img.getAttribute('data-src') || '';
        if (!hosts.some(h => src.includes(h))) return false;
        if (src.includes('/logos/') || src.includes('logo') || src.includes('site.png')
            || src.includes('.svg') || src.includes('footer_') || src.includes('sponsor')
            || src.includes('_logo') || src.includes('wordmark')) return false;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w < 80 || h < 80) return false;
        const ratio = w / h;
        return ratio >= 0.4 && ratio <= 1.1;
      })
      .map(img => ({
        src: img.src || img.getAttribute('data-src') || '',
        area: (img.naturalWidth || img.width || 1) * (img.naturalHeight || img.height || 1)
      }))
      .sort((a, b) => b.area - a.area);
    return candidates[0]?.src || null;
  `;
}

async function scrapePhoto(page, profileUrl, hostFilter) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const photoUrl = await page.evaluate(new Function('return (function() {' + buildPhotoFilter(hostFilter) + '})()'));
    if (photoUrl) {
      try {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        return url.toString();
      } catch { return photoUrl; }
    }
    return null;
  } catch { return null; }
}

async function findProfileUrl(page, rosterUrl, athleteName, teamRosterPath) {
  // The page should already be loaded on the roster page
  // Look for a link matching the athlete name
  try {
    const links = await page.evaluate((name) => {
      const results = [];
      const normalizedName = name.toLowerCase().replace(/[\s'.-]+/g, '');
      document.querySelectorAll('a[href*="/roster/"]').forEach(a => {
        const href = a.href;
        if (!href || href.includes('/coaches/') || href.includes('/staff/') || href.includes('#')) return;
        const text = (a.textContent || '').trim().toLowerCase().replace(/[\s'.-]+/g, '');
        const slug = (href.split('/roster/')[1] || '').split('/')[0].replace(/-/g, '');
        if (text === normalizedName || slug === normalizedName || text.includes(normalizedName) || normalizedName.includes(text)) {
          results.push(href);
        }
      });
      return results;
    }, athleteName.replace(/\s+/g, ' ').trim());
    return links[0] || null;
  } catch { return null; }
}

async function main() {
  console.log('\n🔧 Fixing remaining athletes\n');

  // Step 1: Cal pixelated - just add ?width=1920 to existing calbears.com photos
  console.log('=== Cal pixelated fixes ===');
  const { data: calTeam } = await supabase.from('teams').select('id').eq('name', 'Cal').single();
  for (const name of CAL_PIXELATED) {
    const { data: a } = await supabase.from('athletes').select('id, name, photo_url')
      .eq('team_id', calTeam.id).eq('name', name).single();
    if (!a) { console.log(`  Not found: ${name}`); continue; }
    if (!a.photo_url || !a.photo_url.includes('calbears.com/images/')) {
      console.log(`  ${name}: no calbears photo to upgrade`);
      continue;
    }
    try {
      const url = new URL(a.photo_url);
      url.searchParams.set('width', '1920');
      const newUrl = url.toString();
      if (newUrl !== a.photo_url) {
        await supabase.from('athletes').update({ photo_url: newUrl }).eq('id', a.id);
        console.log(`  ${name}: ✅ upgraded to width=1920`);
      } else {
        console.log(`  ${name}: already has width param`);
      }
    } catch {
      console.log(`  ${name}: URL parse error`);
    }
  }

  // Step 2: Athletes needing roster scrape
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const config of ROSTER_SCRAPES) {
    console.log(`\n=== ${config.team} ===`);
    const { data: teamRow } = await supabase.from('teams').select('id, logo_url').eq('name', config.team).single();
    if (!teamRow) { console.log(`Team not found: ${config.team}`); continue; }

    // Load roster page
    try {
      await page.goto(config.rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log(`  Failed to load roster: ${e.message}`);
      continue;
    }

    for (const athleteName of config.athletes) {
      const { data: a } = await supabase.from('athletes').select('id, name, profile_url, photo_url')
        .eq('team_id', teamRow.id).eq('name', athleteName).single();
      if (!a) { console.log(`  Not found in DB: ${athleteName}`); continue; }

      // Find profile URL if not set
      let profileUrl = a.profile_url;
      // Don't use season roster pages as profile URLs
      if (profileUrl && (profileUrl.includes('/2024-25') || profileUrl.includes('/2025-26') || !profileUrl.split('/roster/')[1]?.includes('-'))) {
        profileUrl = null;
      }

      if (!profileUrl) {
        profileUrl = await findProfileUrl(page, config.rosterUrl, athleteName, config.rosterUrl);
        if (!profileUrl) {
          console.log(`  ${athleteName}: ❌ profile URL not found`);
          continue;
        }
        console.log(`  ${athleteName}: found profile ${profileUrl.split('/roster/')[1] || profileUrl}`);
      }

      const photoUrl = await scrapePhoto(page, profileUrl, config.hostFilter);
      const finalPhoto = photoUrl || teamRow.logo_url;

      await supabase.from('athletes').update({
        photo_url: finalPhoto,
        profile_url: profileUrl,
      }).eq('id', a.id);

      console.log(`  ${athleteName}: ${photoUrl ? '✅' : '❌ no photo'}`);

      // Reload roster page for next athlete
      try {
        await page.goto(config.rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
      } catch { /* ignore */ }
    }
  }

  await browser.close();
  console.log('\nDone.');
}
main().catch(console.error);
