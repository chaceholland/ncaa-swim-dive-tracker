const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const { JSDOM } = require('jsdom');

const supabaseUrl = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(supabaseUrl, supabaseKey);

// Teams that need work
const teamsToScrape = [
  { name: 'South Carolina', url: 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/' },
  { name: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Penn State', url: 'https://gopsusports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Indiana', url: 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Purdue', url: 'https://purduesports.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Dartmouth', url: 'https://dartmouthsports.com/sports/mens-swimming-and-diving/roster' },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function normalizePhotoUrl(url, baseUrl) {
  if (!url) return null;

  url = url.trim();
  if (!url) return null;

  // Skip placeholder images
  if (url.includes('placeholder') || url.includes('default') || url.includes('no-image') || url.includes('blank')) {
    return null;
  }

  // Convert relative URLs to absolute
  if (url.startsWith('/')) {
    const domain = new URL(baseUrl).hostname;
    url = `https://${domain}${url}`;
  } else if (url.startsWith('../')) {
    const domain = new URL(baseUrl).hostname;
    url = `https://${domain}/${url.replace(/^\.\.\//, '')}`;
  }

  // Remove query params for sizing
  if (url.includes('?')) {
    url = url.split('?')[0];
  }

  return url;
}

function normalizeClassYear(year) {
  if (!year) return null;
  const normalized = year.trim().toUpperCase();
  if (normalized.startsWith('FR') || normalized === 'FRESHMAN') return 'freshman';
  if (normalized.startsWith('SO') || normalized === 'SOPHOMORE') return 'sophomore';
  if (normalized.startsWith('JR') || normalized === 'JUNIOR') return 'junior';
  if (normalized.startsWith('SR') || normalized === 'SENIOR') return 'senior';
  if (normalized.startsWith('GR') || normalized.includes('GRADUATE')) return 'senior';
  return null;
}

function classifyAthleteType(position) {
  if (!position) return 'swimmer';
  const posLower = position.toLowerCase();
  if (posLower.includes('dive')) return 'diver';
  return 'swimmer';
}

async function scrapeTeamRoster(teamName, url) {
  console.log(`\n🏊 Scraping ${teamName} from ${url}`);

  try {
    const html = await fetchUrl(url);
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const athletes = [];

    // Pattern 1: Sidearm Sports (most common)
    const sidearmPlayers = document.querySelectorAll('.sidearm-roster-players .sidearm-roster-player');
    if (sidearmPlayers.length > 0) {
      sidearmPlayers.forEach(player => {
        const nameEl = player.querySelector('.sidearm-roster-player-name');
        const photoEl = player.querySelector('img.sidearm-roster-player-image');
        const posEl = player.querySelector('.sidearm-roster-player-position');
        const classEl = player.querySelector('.sidearm-roster-player-class_year');
        const profileLink = player.querySelector('a');

        if (nameEl) {
          athletes.push({
            name: nameEl.textContent.trim(),
            photo_url: photoEl ? (photoEl.getAttribute('src') || photoEl.getAttribute('data-src')) : null,
            position: posEl ? posEl.textContent.trim() : null,
            class_year: classEl ? classEl.textContent.trim() : null,
            profile_url: profileLink ? profileLink.getAttribute('href') : null,
          });
        }
      });
    }

    // Pattern 2: New Sidearm cards
    if (athletes.length === 0) {
      const cards = document.querySelectorAll('.s-person-card');
      if (cards.length > 0) {
        cards.forEach(card => {
          const nameEl = card.querySelector('h3');
          const photoEl = card.querySelector('img');
          const posEl = card.querySelector('.position, [class*="position"]');
          const classEl = card.querySelector('.class-year, [class*="class"]');
          const profileLink = card.querySelector('a');

          if (nameEl) {
            athletes.push({
              name: nameEl.textContent.trim(),
              photo_url: photoEl ? (photoEl.getAttribute('src') || photoEl.getAttribute('data-src')) : null,
              position: posEl ? posEl.textContent.trim() : null,
              class_year: classEl ? classEl.textContent.trim() : null,
              profile_url: profileLink ? profileLink.getAttribute('href') : null,
            });
          }
        });
      }
    }

    // Pattern 3: Table format
    if (athletes.length === 0) {
      const rows = document.querySelectorAll('table tbody tr');
      if (rows.length > 0) {
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const nameEl = cells[0];
            const posEl = cells[1];
            const photoEl = row.querySelector('img');
            const profileLink = row.querySelector('a');

            if (nameEl.textContent.trim()) {
              athletes.push({
                name: nameEl.textContent.trim(),
                photo_url: photoEl ? (photoEl.getAttribute('src') || photoEl.getAttribute('data-src')) : null,
                position: posEl ? posEl.textContent.trim() : null,
                class_year: null,
                profile_url: profileLink ? profileLink.getAttribute('href') : null,
              });
            }
          }
        });
      }
    }

    // Pattern 4: Card/Grid format
    if (athletes.length === 0) {
      const cards = document.querySelectorAll('[class*="roster-card"], [class*="athlete-card"], [class*="player-card"]');
      if (cards.length > 0) {
        cards.forEach(card => {
          const nameEl = card.querySelector('[class*="name"], h3, h4');
          const photoEl = card.querySelector('img');
          const posEl = card.querySelector('[class*="position"]');
          const classEl = card.querySelector('[class*="class"]');
          const profileLink = card.querySelector('a');

          if (nameEl) {
            athletes.push({
              name: nameEl.textContent.trim(),
              photo_url: photoEl ? (photoEl.getAttribute('src') || photoEl.getAttribute('data-src')) : null,
              position: posEl ? posEl.textContent.trim() : null,
              class_year: classEl ? classEl.textContent.trim() : null,
              profile_url: profileLink ? profileLink.getAttribute('href') : null,
            });
          }
        });
      }
    }

    console.log(`✓ Found ${athletes.length} athletes on page`);

    // Filter to only men's athletes
    const menAthletes = athletes.filter(a => {
      const text = (a.name + ' ' + (a.position || '')).toLowerCase();
      return !text.includes('women') && !text.includes('w-');
    });

    console.log(`✓ Filtered to ${menAthletes.length} men's athletes`);

    return menAthletes;
  } catch (error) {
    console.error(`✗ Error scraping ${teamName}:`, error.message);
    return [];
  }
}

async function getTeamId(teamName) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .eq('name', teamName)
      .single();

    if (error) {
      console.error(`  ✗ Team not found: ${teamName}`);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error(`  ✗ Error fetching team ID:`, error.message);
    return null;
  }
}

async function getExistingAthlete(name, teamId) {
  try {
    const { data, error } = await supabase
      .from('athletes')
      .select('id, photo_url')
      .eq('name', name)
      .eq('team_id', teamId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`  ✗ Error checking athlete:`, error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error(`  ✗ Error checking athlete:`, error.message);
    return null;
  }
}

async function updateAthletePhoto(athleteId, photoUrl) {
  try {
    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: photoUrl })
      .eq('id', athleteId);

    if (error) {
      console.error(`    ✗ Update failed:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`    ✗ Error updating athlete:`, error.message);
    return false;
  }
}

async function updateTeamAthleteCount(teamId) {
  try {
    const { count, error: countError } = await supabase
      .from('athletes')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (countError) {
      console.error(`  ✗ Error counting athletes:`, countError.message);
      return;
    }

    const { error } = await supabase
      .from('teams')
      .update({ athlete_count: count })
      .eq('id', teamId);

    if (error) {
      console.error(`  ✗ Error updating athlete count:`, error.message);
    }
  } catch (error) {
    console.error(`  ✗ Error updating team count:`, error.message);
  }
}

async function processTeam(teamName, url) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${teamName}`);
  console.log(`${'='.repeat(60)}`);

  const teamId = await getTeamId(teamName);
  if (!teamId) {
    console.log(`⚠ Skipping ${teamName} - not found in database`);
    return { team: teamName, processed: 0, updated: 0, added: 0, skipped: 0 };
  }

  const athletes = await scrapeTeamRoster(teamName, url);

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const athlete of athletes) {
    const normalizedPhoto = normalizePhotoUrl(athlete.photo_url, url);
    const existingAthlete = await getExistingAthlete(athlete.name, teamId);

    if (existingAthlete) {
      if (!existingAthlete.photo_url && normalizedPhoto) {
        // Update missing photo
        const success = await updateAthletePhoto(existingAthlete.id, normalizedPhoto);
        if (success) {
          console.log(`    ✓ Updated photo for ${athlete.name}`);
          updated++;
        }
      } else {
        skipped++;
      }
    } else {
      skipped++; // New athletes - only updating existing ones per requirements
    }
  }

  await updateTeamAthleteCount(teamId);

  const summary = {
    team: teamName,
    processed: athletes.length,
    added,
    updated,
    skipped,
  };

  console.log(`\n✓ ${teamName} Summary:`);
  console.log(`  - Processed: ${summary.processed} athletes`);
  console.log(`  - Updated photos: ${summary.updated}`);
  console.log(`  - Skipped: ${summary.skipped}`);

  return summary;
}

async function main() {
  console.log('\n🏊 NCAA Swim & Dive Tracker - Lightweight Photo Update Script');
  console.log('='.repeat(60));
  console.log(`Starting at ${new Date().toISOString()}`);

  const results = [];

  for (const team of teamsToScrape) {
    try {
      const result = await processTeam(team.name, team.url);
      results.push(result);
    } catch (error) {
      console.error(`✗ Failed to process ${team.name}:`, error.message);
      results.push({
        team: team.name,
        processed: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Final summary
  console.log('\n\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  results.forEach(r => {
    totalProcessed += r.processed || 0;
    totalUpdated += r.updated || 0;
    totalSkipped += r.skipped || 0;

    const status = r.error ? '✗' : '✓';
    console.log(`${status} ${r.team.padEnd(20)} | Updated: ${String(r.updated).padStart(2)} | Processed: ${String(r.processed).padStart(2)}`);
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`Total Athletes Processed: ${totalProcessed}`);
  console.log(`Total Updated: ${totalUpdated}`);
  console.log(`Total Skipped: ${totalSkipped}`);
  console.log('-'.repeat(60));
  console.log(`Completed at ${new Date().toISOString()}`);

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
