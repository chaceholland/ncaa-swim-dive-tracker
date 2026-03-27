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
  { name: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Penn State', url: 'https://gopsusports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Indiana', url: 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Purdue', url: 'https://purduesports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Dartmouth', url: 'https://dartmouthsports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/m-swim/roster/' },
  { name: 'Florida State', url: 'https://seminoles.com/sports/swimming-diving/roster/' },
  { name: 'NC State', url: 'https://gopack.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Wisconsin', url: 'https://uwbadgers.com/sports/mens-swimming-and-diving/roster' },
  { name: 'West Virginia', url: 'https://wvusports.com/sports/mens-swimming-and-diving/roster' },
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
  try {
    return new URL(url, base).href;
  } catch { return null; }
}

async function scrapeTeamPage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Try to extract athletes using multiple patterns
  const athletes = await page.evaluate((baseUrl) => {
    const results = [];
    const seen = new Set();

    function addAthlete(name, photoUrl, position, year, hometown, profileUrl) {
      name = (name || '').trim().replace(/\s+/g, ' ');
      if (!name || name.length < 3 || name.length > 60) return;
      if (seen.has(name.toLowerCase())) return;
      // Skip coach entries
      if (/coach|head |assistant|director|manager|volunteer/i.test(name)) return;
      if (/coach|head |assistant|director|manager|volunteer/i.test(position || '')) return;
      seen.add(name.toLowerCase());
      results.push({ name, photoUrl: photoUrl || null, position: position || null, year: year || null, hometown: (hometown || '').trim() || null, profileUrl: profileUrl || null });
    }

    function getImgUrl(el) {
      if (!el) return null;
      const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (!img) return null;
      return img.getAttribute('data-src') || img.src || null;
    }

    // Pattern 1: Sidearm roster players
    const sidearmPlayers = document.querySelectorAll('.sidearm-roster-player');
    if (sidearmPlayers.length > 0) {
      sidearmPlayers.forEach(player => {
        const nameEl = player.querySelector('.sidearm-roster-player-name a, .sidearm-roster-player-name h3, .sidearm-roster-player-name, h3 a, h3');
        const name = nameEl?.textContent;
        const imgEl = player.querySelector('img.sidearm-roster-player-image, img.roster-image, .sidearm-roster-player-image img, img');
        const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
        const posEl = player.querySelector('.sidearm-roster-player-position, .position');
        const yearEl = player.querySelector('.sidearm-roster-player-academic-year, .sidearm-roster-player-year, .year, .class');
        const htEl = player.querySelector('.sidearm-roster-player-hometown, .hometown');
        const linkEl = player.querySelector('a[href*="/roster/"]') || nameEl?.closest('a') || player.querySelector('a');
        addAthlete(name, photoUrl, posEl?.textContent, yearEl?.textContent, htEl?.textContent, linkEl?.href);
      });
    }

    // Pattern 2: New Sidearm card design
    const cards = document.querySelectorAll('.s-person-card');
    if (cards.length > 0 && results.length === 0) {
      cards.forEach(card => {
        const nameEl = card.querySelector('h3, .s-person-card__name');
        const name = nameEl?.textContent;
        const imgEl = card.querySelector('img');
        const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
        const posEl = card.querySelector('.s-person-details__detail-wrapper, .s-person-card__meta');
        const htEl = card.querySelector('.s-person-card__content__location');
        const linkEl = card.querySelector('a');
        const details = card.querySelectorAll('.s-person-details__detail-wrapper span, .s-person-card__meta span');
        let year = null;
        details.forEach(d => { if (/fr|so|jr|sr|gr|freshman|sophomore|junior|senior/i.test(d.textContent)) year = d.textContent; });
        addAthlete(name, photoUrl, posEl?.textContent, year, htEl?.textContent, linkEl?.href);
      });
    }

    // Pattern 3: Table-based rosters
    if (results.length === 0) {
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr, tr');
        if (rows.length < 3) continue;
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 2) return;
          const nameEl = row.querySelector('a, td:first-child');
          const name = nameEl?.textContent;
          const imgEl = row.querySelector('img');
          const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
          let position = null, year = null, hometown = null, profileUrl = null;
          profileUrl = row.querySelector('a')?.href;
          cells.forEach(cell => {
            const text = cell.textContent.trim();
            if (/^(Fr|So|Jr|Sr|Gr|Freshman|Sophomore|Junior|Senior)/i.test(text) && text.length < 15) year = text;
            if (/swim|dive|free|back|breast|fly|stroke|IM|sprint|distance|medley/i.test(text) && text.length < 30) position = text;
            if (/,\s*[A-Z]{2}$/.test(text) || (text.includes('/') && text.length > 5 && text.length < 50)) hometown = text;
          });
          addAthlete(name, photoUrl, position, year, hometown, profileUrl);
        });
      }
    }

    // Pattern 4: Generic roster cards/list items
    if (results.length === 0) {
      const containers = document.querySelectorAll('.roster-card, .athlete-card, .player-card, [class*="roster"] li, [class*="player"] article');
      containers.forEach(card => {
        const nameEl = card.querySelector('h3, h4, .name, .player-name, a');
        const name = nameEl?.textContent;
        const imgEl = card.querySelector('img');
        const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
        const posEl = card.querySelector('.position, .event');
        const yearEl = card.querySelector('.year, .class, .class-year');
        const htEl = card.querySelector('.hometown');
        const linkEl = card.querySelector('a[href]');
        addAthlete(name, photoUrl, posEl?.textContent, yearEl?.textContent, htEl?.textContent, linkEl?.href);
      });
    }

    // Pattern 5: Ohio State style (custom layout)
    if (results.length === 0) {
      const items = document.querySelectorAll('[class*="roster"] [class*="item"], [class*="roster"] [class*="card"], [class*="person"]');
      items.forEach(item => {
        const nameEl = item.querySelector('h3, h4, .name, a');
        const name = nameEl?.textContent;
        const imgEl = item.querySelector('img');
        const photoUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null;
        addAthlete(name, photoUrl, null, null, null, item.querySelector('a')?.href);
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
  console.log(`${'='.repeat(60)}`);

  // Get team from DB
  const { data: team } = await supabase.from('teams').select('id, name').ilike('name', teamName).single();
  if (!team) {
    console.log(`  ✗ Team "${teamName}" not found in database`);
    return { added: 0, updated: 0, processed: 0 };
  }

  // Get existing athletes
  const { data: existingAthletes } = await supabase.from('athletes').select('id, name, photo_url').eq('team_id', team.id);
  const existingMap = new Map();
  (existingAthletes || []).forEach(a => existingMap.set(a.name.toLowerCase().trim(), a));

  let added = 0, updated = 0, skipped = 0;

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
        // Exists - only update if missing photo
        if (!existing.photo_url && photoUrl) {
          const { error } = await supabase.from('athletes').update({ photo_url: photoUrl }).eq('id', existing.id);
          if (!error) {
            console.log(`  📸 Updated photo for ${athlete.name}`);
            updated++;
          }
        } else {
          skipped++;
        }
      } else {
        // New athlete - insert
        const { error } = await supabase.from('athletes').insert({
          name: athlete.name,
          team_id: team.id,
          photo_url: photoUrl,
          athlete_type: athleteType,
          class_year: classYear,
          hometown: athlete.hometown,
          profile_url: profileUrl,
        });
        if (!error) {
          console.log(`  ➕ Added: ${athlete.name} (${athleteType}, ${classYear || 'unknown year'})`);
          added++;
        } else {
          console.log(`  ✗ Error adding ${athlete.name}: ${error.message}`);
        }
      }
    }

    // Update team athlete count
    const { count } = await supabase.from('athletes').select('*', { count: 'exact', head: true }).eq('team_id', team.id);
    await supabase.from('teams').update({ athlete_count: count, updated_at: new Date().toISOString() }).eq('id', team.id);
    console.log(`  ✓ Team athlete count: ${count}`);

  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  } finally {
    await context.close();
  }

  console.log(`  ✅ ${teamName}: +${added} new, ${updated} photos updated, ${skipped} unchanged`);
  return { added, updated, processed: added + updated + skipped };
}

async function main() {
  console.log('🏊 NCAA Swim & Dive - Data Update');
  console.log('Starting at', new Date().toISOString());

  const browser = await chromium.launch({ headless: true });
  const totals = { added: 0, updated: 0 };

  for (const team of teamsToScrape) {
    try {
      const result = await processTeam(browser, team);
      totals.added += result.added;
      totals.updated += result.updated;
    } catch (err) {
      console.log(`  ✗ Fatal error for ${team.name}: ${err.message}`);
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log('FINAL TOTALS');
  console.log(`  Added: ${totals.added}`);
  console.log(`  Updated photos: ${totals.updated}`);
  console.log(`Completed at ${new Date().toISOString()}`);
}

main().catch(console.error);
