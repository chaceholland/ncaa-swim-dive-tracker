require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TEAMS = [
  { name: 'Georgia Tech',   rosterUrl: 'https://ramblinwreck.com/sports/c-swim/roster',      host: 'ramblinwreck.com' },
  { name: 'Virginia',       rosterUrl: 'https://virginiasports.com/sports/swimming/roster',   host: 'virginiasports.com' },
  { name: 'Virginia Tech',  rosterUrl: 'https://hokiesports.com/sports/swimming-diving/roster', host: 'hokiesports.com' },
];

function normalizeName(n) {
  return n.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Extract the name slug - last meaningful path segment
function extractNameSlug(href) {
  const url = href.replace(/\/$/, ''); // remove trailing slash
  const parts = url.split('/');
  const last = parts[parts.length - 1];
  // Skip numeric IDs and common non-name segments
  if (last.match(/^\d+$/) || ['roster', 'player', 'season', 'coach'].includes(last)) return '';
  // Year-like segment
  if (last.match(/^\d{4}-\d{2}$/)) return '';
  return last.replace(/-/g, ' ');
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
        return ratio >= 0.35 && ratio <= 1.3;
      });
      candidates.sort((a, b) => ((b.naturalWidth || b.width) * (b.naturalHeight || b.height)) - ((a.naturalWidth || a.width) * (a.naturalHeight || a.height)));
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
    // Fix athletes that still have no individual profile URL
    const needsFix = athletes.filter(a => {
      if (!a.profile_url) return true;
      if (a.profile_url.match(/\/roster\/?$/) || a.profile_url.match(/\/roster\/\d{4}-\d{2}\/?$/)) return true;
      return false;
    });
    console.log('  ' + needsFix.length + '/' + athletes.length + ' need fixing');
    if (needsFix.length === 0) continue;

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
        if (!href.includes(host)) return;
        if (seen.has(href)) return;
        if (href.includes('/coach/') || href.includes('/coaches/') || href.includes('#')) return;
        if (!href.includes('/roster/') && !href.includes('/player/')) return;
        const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
        seen.add(href);
        results.push({ href, text: text.slice(0, 60) });
      });
      return results;
    }, team.host);

    console.log('  Found ' + links.length + ' roster links');

    // Build slug → href map
    const slugMap = {};
    for (const l of links) {
      const slug = extractNameSlug(l.href);
      if (slug && slug.length > 3) slugMap[slug] = l.href;
    }

    for (const athlete of needsFix) {
      const normalName = normalizeName(athlete.name);
      const words = normalName.split(' ');

      // Find slug that contains all words of the athlete name
      let matchedHref = null;
      for (const [slug, href] of Object.entries(slugMap)) {
        if (words.length >= 2 && words.every(w => slug.includes(w))) {
          matchedHref = href;
          break;
        }
      }

      // Also try text match
      if (!matchedHref) {
        const textMatch = links.find(l => {
          const lt = normalizeName(l.text);
          return lt.length > 3 && words.every(w => lt.includes(w));
        });
        if (textMatch) matchedHref = textMatch.href;
      }

      if (!matchedHref) {
        console.log('  ❌ Not found on roster: ' + athlete.name);
        await supabase.from('athletes').update({ profile_url: null }).eq('id', athlete.id);
        continue;
      }

      const photo = await getAthletePhoto(page, matchedHref, team.host);
      const update = { profile_url: matchedHref };
      if (photo) update.photo_url = photo;
      await supabase.from('athletes').update(update).eq('id', athlete.id);
      console.log('  ' + (photo ? '✅' : '⚠️ ') + ' ' + athlete.name + ' -> ' + matchedHref.split(team.host)[1]);
    }
  }

  await browser.close();
  console.log('\nDone!');
}
main().catch(console.error);
