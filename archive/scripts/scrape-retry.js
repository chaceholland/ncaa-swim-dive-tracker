const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';
const supabase = createClient(supabaseUrl, supabaseKey);

const teamsToScrape = [
  { name: 'Georgia Tech', url: 'https://ramblinwreck.com/sports/mens-swimming-diving/roster/' },
  { name: 'Alabama', url: 'https://rolltide.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Duke', url: 'https://goduke.com/sports/mens-swimming-and-diving/roster' },
  { name: 'TCU', url: 'https://gofrogs.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Louisville', url: 'https://gocards.com/sports/mens-swimming-and-diving/roster' },
  { name: 'South Carolina', url: 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/' },
  { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/m-swim/roster/' },
  { name: 'Florida State', url: 'https://seminoles.com/sports/swimming-diving/roster/' },
  { name: 'NC State', url: 'https://gopack.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Virginia Tech', url: 'https://hokiesports.com/sports/mens-swimming-and-diving/roster' },
];

function normalizeClassYear(year) {
  if (!year) return null;
  const n = year.trim().replace(/\./g, '').toUpperCase();
  if (/^FR|FRESHMAN|^1ST/i.test(n)) return 'freshman';
  if (/^SO|SOPHOMORE|^2ND/i.test(n)) return 'sophomore';
  if (/^JR|JUNIOR|^3RD/i.test(n)) return 'junior';
  if (/^SR|SENIOR|^4TH|^GR|GRADUATE|^5TH/i.test(n)) return 'senior';
  return null;
}

function classifyType(pos) {
  if (!pos) return 'swimmer';
  return /dive/i.test(pos) ? 'diver' : 'swimmer';
}

function makeAbsolute(url, base) {
  if (!url || url.startsWith('data:') || url.includes('placeholder') || url.includes('default-')) return null;
  try { return new URL(url, base).href; } catch { return null; }
}

async function scrapeTeamPage(page, url) {
  // Use networkidle and longer timeout for JS-heavy sites
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(10000);

  // Try scrolling to trigger lazy-loaded content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);

  const athletes = await page.evaluate((baseUrl) => {
    const results = [];
    const seen = new Set();

    function addAthlete(name, photoUrl, position, year, hometown, profileUrl) {
      name = (name || '').trim().replace(/\s+/g, ' ');
      if (!name || name.length < 3 || name.length > 60) return;
      if (seen.has(name.toLowerCase())) return;
      if (/coach|head |assistant|director|manager|volunteer/i.test(name)) return;
      if (/coach|head |assistant|director|manager|volunteer/i.test(position || '')) return;
      seen.add(name.toLowerCase());
      results.push({ name, photoUrl: photoUrl || null, position: position || null, year: year || null, hometown: (hometown || '').trim() || null, profileUrl: profileUrl || null });
    }

    // Pattern 1: Sidearm roster players
    document.querySelectorAll('.sidearm-roster-player').forEach(player => {
      const nameEl = player.querySelector('.sidearm-roster-player-name a, .sidearm-roster-player-name h3, .sidearm-roster-player-name, h3 a, h3');
      const imgEl = player.querySelector('img');
      const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
      const posEl = player.querySelector('.sidearm-roster-player-position, .position');
      const yearEl = player.querySelector('.sidearm-roster-player-academic-year, .sidearm-roster-player-year, .year, .class');
      const htEl = player.querySelector('.sidearm-roster-player-hometown, .hometown');
      const linkEl = player.querySelector('a[href*="/roster/"]') || (nameEl && nameEl.closest('a')) || player.querySelector('a');
      addAthlete(nameEl?.textContent, photoUrl, posEl?.textContent, yearEl?.textContent, htEl?.textContent, linkEl?.href);
    });

    // Pattern 2: s-person-card (new Sidearm)
    if (results.length === 0) {
      document.querySelectorAll('.s-person-card, [class*="s-person"]').forEach(card => {
        const nameEl = card.querySelector('h3, .s-person-card__name, [class*="person__name"]');
        const imgEl = card.querySelector('img');
        const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
        const linkEl = card.querySelector('a');
        const details = card.querySelectorAll('span, .s-person-card__meta span, [class*="detail"] span');
        let year = null, position = null;
        details.forEach(d => {
          const t = d.textContent.trim();
          if (/^(Fr|So|Jr|Sr|Gr|Freshman|Sophomore|Junior|Senior)/i.test(t) && t.length < 15) year = t;
          if (/swim|dive|free|back|breast|fly|stroke|IM|sprint|distance|medley/i.test(t)) position = t;
        });
        const htEl = card.querySelector('[class*="location"], [class*="hometown"]');
        addAthlete(nameEl?.textContent, photoUrl, position, year, htEl?.textContent, linkEl?.href);
      });
    }

    // Pattern 3: Tables
    if (results.length === 0) {
      document.querySelectorAll('table').forEach(table => {
        const rows = table.querySelectorAll('tbody tr, tr');
        if (rows.length < 3) return;
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 2) return;
          const nameEl = row.querySelector('a, td:first-child');
          const imgEl = row.querySelector('img');
          const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
          let position = null, year = null, hometown = null;
          cells.forEach(cell => {
            const t = cell.textContent.trim();
            if (/^(Fr|So|Jr|Sr|Gr|Freshman|Sophomore|Junior|Senior)/i.test(t) && t.length < 15) year = t;
            if (/swim|dive|free|back|breast|fly|stroke|IM|sprint|distance|medley/i.test(t) && t.length < 30) position = t;
            if (/,\s*[A-Z]{2}$/.test(t) || (t.includes('/') && t.length > 5 && t.length < 50)) hometown = t;
          });
          addAthlete(nameEl?.textContent, photoUrl, position, year, hometown, row.querySelector('a')?.href);
        });
      });
    }

    // Pattern 4: Any element with roster-like classes
    if (results.length === 0) {
      document.querySelectorAll('.roster-card, .athlete-card, .player-card, [class*="roster"] li, [class*="player"] article, [class*="roster-item"], [class*="person-card"]').forEach(card => {
        const nameEl = card.querySelector('h3, h4, .name, .player-name, a');
        const imgEl = card.querySelector('img');
        const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
        const posEl = card.querySelector('.position, .event');
        const yearEl = card.querySelector('.year, .class, .class-year');
        const htEl = card.querySelector('.hometown');
        addAthlete(nameEl?.textContent, photoUrl, posEl?.textContent, yearEl?.textContent, htEl?.textContent, card.querySelector('a')?.href);
      });
    }

    // Pattern 5: Look for ANY links inside roster-like containers with names
    if (results.length === 0) {
      const allLinks = document.querySelectorAll('a[href*="/roster/"], a[href*="/bio/"], a[href*="player"]');
      allLinks.forEach(link => {
        const text = link.textContent.trim();
        // Names typically have first/last separated by space
        if (text.split(' ').length >= 2 && text.length > 4 && text.length < 50) {
          const container = link.closest('div, li, article, tr');
          const imgEl = container ? container.querySelector('img') : null;
          const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
          addAthlete(text, photoUrl, null, null, null, link.href);
        }
      });
    }

    return results;
  }, url);

  return athletes;
}

async function processTeam(browser, teamInfo) {
  const { name: teamName, url } = teamInfo;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${teamName}`);

  const { data: team } = await supabase.from('teams').select('id, name').ilike('name', teamName).single();
  if (!team) { console.log(`  ✗ Team not found in DB`); return { added: 0, updated: 0 }; }

  const { data: existingAthletes } = await supabase.from('athletes').select('id, name, photo_url').eq('team_id', team.id);
  const existingMap = new Map();
  (existingAthletes || []).forEach(a => existingMap.set(a.name.toLowerCase().trim(), a));

  let added = 0, updated = 0, skipped = 0;
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    console.log(`  🌐 Scraping ${url}`);
    const athletes = await scrapeTeamPage(page, url);
    console.log(`  📊 Found ${athletes.length} athletes on page`);

    for (const athlete of athletes) {
      const photoUrl = makeAbsolute(athlete.photoUrl, url);
      const profileUrl = makeAbsolute(athlete.profileUrl, url);
      const classYear = normalizeClassYear(athlete.year);
      const athleteType = classifyType(athlete.position);
      const existing = existingMap.get(athlete.name.toLowerCase().trim());

      if (existing) {
        if (!existing.photo_url && photoUrl) {
          const { error } = await supabase.from('athletes').update({ photo_url: photoUrl }).eq('id', existing.id);
          if (!error) { console.log(`  📸 Updated photo for ${athlete.name}`); updated++; }
        } else { skipped++; }
      } else {
        const { error } = await supabase.from('athletes').insert({
          name: athlete.name, team_id: team.id, photo_url: photoUrl,
          athlete_type: athleteType, class_year: classYear,
          hometown: athlete.hometown, profile_url: profileUrl,
        });
        if (!error) { console.log(`  ➕ Added: ${athlete.name}`); added++; }
        else { console.log(`  ✗ Error: ${error.message}`); }
      }
    }

    const { count } = await supabase.from('athletes').select('*', { count: 'exact', head: true }).eq('team_id', team.id);
    await supabase.from('teams').update({ athlete_count: count, updated_at: new Date().toISOString() }).eq('id', team.id);
    console.log(`  ✓ Team athlete count: ${count}`);
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  } finally {
    await context.close();
  }
  console.log(`  ✅ ${teamName}: +${added} new, ${updated} photos updated, ${skipped} unchanged`);
  return { added, updated };
}

async function main() {
  console.log('🏊 NCAA Swim & Dive - Retry Scrape (longer waits)');
  const browser = await chromium.launch({ headless: true });
  const totals = { added: 0, updated: 0 };

  for (const team of teamsToScrape) {
    try {
      const result = await processTeam(browser, team);
      totals.added += result.added;
      totals.updated += result.updated;
    } catch (err) {
      console.log(`  ✗ Fatal: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\nFINAL: Added ${totals.added}, Updated photos ${totals.updated}`);
}

main().catch(console.error);
