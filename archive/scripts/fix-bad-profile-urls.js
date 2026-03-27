require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TEAMS = [
  { name: 'Duke',           rosterUrl: 'https://goduke.com/sports/swimming-and-diving/roster',           host: 'goduke.com' },
  { name: 'Georgia Tech',   rosterUrl: 'https://ramblinwreck.com/sports/c-swim/roster',                  host: 'ramblinwreck.com' },
  { name: 'Louisville',     rosterUrl: 'https://gocards.com/sports/swimming-and-diving/roster',           host: 'gocards.com' },
  { name: 'NC State',       rosterUrl: 'https://gopack.com/sports/swimming-and-diving/roster',            host: 'gopack.com' },
  { name: 'Notre Dame',     rosterUrl: 'https://fightingirish.com/sports/swim/roster',                    host: 'fightingirish.com' },
  { name: 'Pittsburgh',     rosterUrl: 'https://pittsburghpanthers.com/sports/swimming-and-diving/roster', host: 'pittsburghpanthers.com' },
  { name: 'South Carolina', rosterUrl: 'https://gamecocksonline.com/sports/swimming/roster',              host: 'gamecocksonline.com' },
  { name: 'TCU',            rosterUrl: 'https://gofrogs.com/sports/swimming-and-diving/roster',           host: 'gofrogs.com' },
  { name: 'Virginia',       rosterUrl: 'https://virginiasports.com/sports/swimming/roster',               host: 'virginiasports.com' },
  { name: 'Virginia Tech',  rosterUrl: 'https://hokiesports.com/sports/swimming-diving/roster',           host: 'hokiesports.com' },
  // Ohio State: known broken, just null out bad profile URLs
];

function normalizeName(n) {
  return n.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isIndividualProfileUrl(url) {
  if (!url) return false;
  // Must have /roster/ followed by more path including a name segment
  // Reject bare roster pages
  if (url.match(/\/roster\/?$/) || url.match(/\/roster\/\d{4}-\d{2}\/?$/)) return false;
  return url.match(/\/roster\/[^\/]+/) !== null || url.match(/\/player\//) !== null;
}

async function getAthletePhoto(page, profileUrl, host) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photo = await page.evaluate((host) => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const candidates = imgs.filter(img => {
        const src = img.src || '';
        if (!src.includes(host) && !src.includes('cloudfront.net') && !src.includes('supabase') && !src.includes('googleapis.com')) return false;
        if (src.includes('logo') || src.includes('.svg') || src.includes('sponsor') || src.includes('partner')) return false;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w < 80 || h < 80) return false;
        const ratio = w / h;
        return ratio >= 0.4 && ratio <= 1.2;
      });
      candidates.sort((a, b) => {
        const aArea = (a.naturalWidth || a.width) * (a.naturalHeight || a.height);
        const bArea = (b.naturalWidth || b.width) * (b.naturalHeight || b.height);
        return bArea - aArea;
      });
      return candidates[0]?.src || null;
    }, host);

    return photo;
  } catch {
    return null;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Fix Ohio State - just null out bad profile URLs
  console.log('\n=== Ohio State: nulling out broken roster profile URLs ===');
  const { data: osuTeam } = await supabase.from('teams').select('id').eq('name', 'Ohio State').single();
  const { data: osuAthletes } = await supabase.from('athletes').select('id, name, profile_url').eq('team_id', osuTeam.id);
  const osuBad = osuAthletes.filter(a => a.profile_url && a.profile_url.includes('/c-swim/roster/') && !isIndividualProfileUrl(a.profile_url));
  for (const a of osuBad) {
    await supabase.from('athletes').update({ profile_url: null }).eq('id', a.id);
    console.log('  Cleared: ' + a.name);
  }

  // Process each team
  for (const team of TEAMS) {
    console.log('\n=== ' + team.name + ' ===');

    const { data: teamRow } = await supabase.from('teams').select('id, logo_url').eq('name', team.name).single();
    const { data: athletes } = await supabase.from('athletes').select('id, name, photo_url, profile_url').eq('team_id', teamRow.id);

    // Find athletes with bad profile URLs (roster-level, not individual)
    const needsFix = athletes.filter(a => !isIndividualProfileUrl(a.profile_url));
    if (needsFix.length === 0) {
      console.log('  No bad profile URLs found');
      continue;
    }
    console.log('  ' + needsFix.length + ' athletes need fixing');

    // Load roster page and collect individual athlete profile links
    console.log('  Loading roster page...');
    try {
      await page.goto(team.rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('  ERROR loading roster: ' + e.message.substring(0, 60));
      continue;
    }

    const links = await page.evaluate((host) => {
      const seen = new Set();
      const results = [];
      document.querySelectorAll('a').forEach(a => {
        const href = a.href || '';
        const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
        if (!href.includes(host)) return;
        if (seen.has(href)) return;
        if (href.includes('/coaches/') || href.includes('#') || href.includes('/roster/') && href.match(/\/roster\/?$/) ) return;
        // Must look like an individual profile - has /roster/ followed by a name slug
        if (!href.match(/\/roster\/[a-z]/) && !href.match(/\/player\/[a-z]/)) return;
        seen.add(href);
        results.push({ href, text: text.slice(0, 60) });
      });
      return results;
    }, team.host);

    console.log('  Found ' + links.length + ' profile links on roster page');

    // Match links to athletes needing fixes
    for (const athlete of needsFix) {
      const normalAthlete = normalizeName(athlete.name);

      // Try to match by text content of link
      let match = links.find(l => {
        const normalLink = normalizeName(l.text);
        if (!normalLink) return false;
        // Check if athlete name words appear in link text
        const words = normalAthlete.split(' ');
        return words.every(w => normalLink.includes(w));
      });

      // Also try matching by URL slug if text match failed
      if (!match) {
        match = links.find(l => {
          const slug = l.href.split('/roster/')[1]?.split('/')[0] || l.href.split('/player/')[1]?.split('/')[0] || '';
          const slugNorm = slug.replace(/-/g, ' ');
          const words = normalAthlete.split(' ');
          return words.length >= 2 && words.every(w => slugNorm.includes(w));
        });
      }

      if (!match) {
        console.log('  ❌ No profile link found for: ' + athlete.name);
        // Clear the bad profile URL
        await supabase.from('athletes').update({ profile_url: null }).eq('id', athlete.id);
        continue;
      }

      const profileUrl = match.href;
      console.log('  ' + athlete.name + ' -> ' + profileUrl.split(team.host)[1]);

      // Get photo from profile page
      const photo = await getAthletePhoto(page, profileUrl, team.host);

      const update = { profile_url: profileUrl };
      if (photo) {
        update.photo_url = photo;
        console.log('    ✅ photo: ' + photo.substring(0, 70));
      } else {
        console.log('    ⚠️  no photo found, keeping existing');
      }

      await supabase.from('athletes').update(update).eq('id', athlete.id);
    }
  }

  await browser.close();
  console.log('\nDone!');
}
main().catch(console.error);
