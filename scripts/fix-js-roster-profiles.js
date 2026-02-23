require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TEAMS = [
  { name: 'Georgia Tech',   rosterUrl: 'https://ramblinwreck.com/sports/c-swim/roster',                  host: 'ramblinwreck.com' },
  { name: 'South Carolina', rosterUrl: 'https://gamecocksonline.com/sports/swimming/roster',              host: 'gamecocksonline.com' },
  { name: 'Virginia',       rosterUrl: 'https://virginiasports.com/sports/swimming/roster',               host: 'virginiasports.com' },
  { name: 'Virginia Tech',  rosterUrl: 'https://hokiesports.com/sports/swimming-diving/roster',           host: 'hokiesports.com' },
];

function normalizeName(n) {
  return n.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isIndividualProfileUrl(url) {
  if (!url) return false;
  if (url.match(/\/roster\/?$/) || url.match(/\/roster\/\d{4}-\d{2}\/?$/)) return false;
  return url.match(/\/roster\/[^\/]+\/[^\/]+/) !== null || url.match(/\/player\//) !== null;
}

async function getAthletePhoto(page, profileUrl, host) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    return await page.evaluate((host) => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const candidates = imgs.filter(img => {
        const src = img.src || '';
        if (!src.includes(host) && !src.includes('cloudfront.net') && !src.includes('supabase') && !src.includes('googleapis.com') && !src.includes('imgproxy')) return false;
        if (src.includes('logo') || src.includes('.svg') || src.includes('sponsor')) return false;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w < 80 || h < 80) return false;
        const ratio = w / h;
        return ratio >= 0.4 && ratio <= 1.3;
      });
      candidates.sort((a, b) => {
        const aArea = (a.naturalWidth || a.width) * (a.naturalHeight || a.height);
        const bArea = (b.naturalWidth || b.width) * (b.naturalHeight || b.height);
        return bArea - aArea;
      });
      return candidates[0]?.src || null;
    }, host);
  } catch { return null; }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const team of TEAMS) {
    console.log('\n=== ' + team.name + ' ===');
    const { data: teamRow } = await supabase.from('teams').select('id, logo_url').eq('name', team.name).single();
    const { data: athletes } = await supabase.from('athletes').select('id, name, photo_url, profile_url').eq('team_id', teamRow.id);
    const needsFix = athletes.filter(a => !isIndividualProfileUrl(a.profile_url));
    console.log('  ' + needsFix.length + '/' + athletes.length + ' need fixing');

    // Load with networkidle and longer wait
    try {
      await page.goto(team.rosterUrl, { waitUntil: 'networkidle', timeout: 25000 });
    } catch {
      await page.goto(team.rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    }
    await page.waitForTimeout(5000);

    const links = await page.evaluate((host) => {
      const seen = new Set();
      const results = [];
      document.querySelectorAll('a').forEach(a => {
        const href = a.href || '';
        const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
        if (!href.includes(host)) return;
        if (seen.has(href)) return;
        if (href.includes('/coaches/') || href.includes('/coach/') || href.includes('#')) return;
        // Individual profile: has roster + name segment with at least 2 path parts after /roster/
        const afterRoster = href.split('/roster/')[1] || '';
        const afterPlayer = href.split('/player/')[1] || '';
        if (!afterRoster.includes('/') && !afterPlayer && !href.includes('/player/')) return;
        // Must have a name-like segment (letters and hyphens)
        const segment = afterRoster.split('/')[0] || afterPlayer.split('/')[0] || '';
        if (!segment.match(/^[a-z-]{3,}$/)) return;
        seen.add(href);
        results.push({ href, text: text.slice(0, 60) });
      });
      return results;
    }, team.host);

    console.log('  Found ' + links.length + ' individual profile links');
    links.slice(0, 5).forEach(l => console.log('    sample: [' + l.text + '] -> ' + l.href.split(team.host)[1]));

    if (links.length === 0) {
      // Try a broader search - any href containing athlete names
      const allHrefs = await page.evaluate((host) => {
        const seen = new Set();
        const results = [];
        document.querySelectorAll('a[href*="' + host + '"]').forEach(a => {
          if (seen.has(a.href)) return;
          seen.add(a.href);
          const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
          results.push({ href: a.href, text: text.slice(0, 60) });
        });
        return results.slice(0, 20);
      }, team.host);
      console.log('  Broad search found ' + allHrefs.length + ' links:');
      allHrefs.forEach(l => console.log('    [' + l.text + '] -> ' + l.href.split(team.host)[1]));
      continue;
    }

    for (const athlete of needsFix) {
      const normalAthlete = normalizeName(athlete.name);
      let match = links.find(l => {
        const normalLink = normalizeName(l.text);
        if (!normalLink || normalLink.length < 3) return false;
        const words = normalAthlete.split(' ');
        return words.every(w => normalLink.includes(w));
      });
      if (!match) {
        match = links.find(l => {
          const slug = (l.href.split('/roster/')[1] || l.href.split('/player/')[1] || '').split('/')[0].replace(/-/g, ' ');
          const words = normalAthlete.split(' ');
          return words.length >= 2 && words.every(w => slug.includes(w));
        });
      }

      if (!match) {
        console.log('  ❌ No match: ' + athlete.name);
        await supabase.from('athletes').update({ profile_url: null }).eq('id', athlete.id);
        continue;
      }

      const profileUrl = match.href;
      const photo = await getAthletePhoto(page, profileUrl, team.host);
      const update = { profile_url: profileUrl };
      if (photo) update.photo_url = photo;
      await supabase.from('athletes').update(update).eq('id', athlete.id);
      console.log('  ' + (photo ? '✅' : '⚠️ ') + ' ' + athlete.name + ' -> ' + profileUrl.split(team.host)[1]);
    }
  }

  await browser.close();
  console.log('\nDone!');
}
main().catch(console.error);
