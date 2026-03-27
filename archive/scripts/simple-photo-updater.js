const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(supabaseUrl, supabaseKey);

// Teams with missing photos
const teamsToScrape = [
  { name: 'South Carolina', url: 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/', missingPhotos: 3 },
  { name: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster', missingPhotos: 5 },
  { name: 'Penn State', url: 'https://gopsusports.com/sports/mens-swimming-and-diving/roster', missingPhotos: 4 },
  { name: 'Indiana', url: 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster', missingPhotos: 4 },
  { name: 'Purdue', url: 'https://purduesports.com/sports/mens-swimming-and-diving/roster', missingPhotos: 4 },
  { name: 'Dartmouth', url: 'https://dartmouthsports.com/sports/mens-swimming-and-diving/roster', missingPhotos: 1 },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseAthletes(html, url) {
  const athletes = [];

  // Pattern 1: Sidearm format - look for roster-player divs
  const playerRegex = /<div[^>]*class="[^"]*sidearm-roster-player[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g;
  let match;

  while ((match = playerRegex.exec(html)) !== null) {
    const playerHtml = match[0];

    // Extract name
    const nameMatch = playerHtml.match(/<span[^>]*class="[^"]*sidearm-roster-player-name[^"]*"[^>]*>([^<]+)<\/span>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    // Extract photo URL
    let photoUrl = null;
    const imgMatch = playerHtml.match(/<img[^>]*(?:src|data-src)="([^"]+)"[^>]*class="[^"]*sidearm-roster-player-image[^"]*"/) ||
                     playerHtml.match(/<img[^>]*class="[^"]*sidearm-roster-player-image[^"]*"[^>]*(?:src|data-src)="([^"]+)"/);
    if (imgMatch) {
      photoUrl = imgMatch[1];
    }

    // Extract position
    const posMatch = playerHtml.match(/<span[^>]*class="[^"]*sidearm-roster-player-position[^"]*"[^>]*>([^<]+)<\/span>/);
    const position = posMatch ? posMatch[1].trim() : null;

    // Extract class year
    const classMatch = playerHtml.match(/<span[^>]*class="[^"]*sidearm-roster-player-class_year[^"]*"[^>]*>([^<]+)<\/span>/);
    const classYear = classMatch ? classMatch[1].trim() : null;

    athletes.push({ name, photoUrl, position, classYear });
  }

  return athletes;
}

function normalizePhotoUrl(url, baseUrl) {
  if (!url) return null;

  url = url.trim();
  if (!url || url.includes('placeholder') || url.includes('default') || url.includes('no-image')) {
    return null;
  }

  if (url.startsWith('/')) {
    const domain = new URL(baseUrl).hostname;
    url = `https://${domain}${url}`;
  } else if (url.startsWith('../')) {
    const domain = new URL(baseUrl).hostname;
    url = `https://${domain}/${url.replace(/^\.\.\//, '')}`;
  }

  if (url.includes('?')) {
    url = url.split('?')[0];
  }

  return url;
}

async function scrapeTeamRoster(teamName, url) {
  console.log(`\n🏊 Scraping ${teamName} from ${url}`);

  try {
    const html = await fetchUrl(url);
    const athletes = parseAthletes(html, url);

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

async function getAthletesWithMissingPhotos(teamId) {
  try {
    const { data, error } = await supabase
      .from('athletes')
      .select('id, name')
      .eq('team_id', teamId)
      .is('photo_url', null);

    if (error) {
      console.error(`  ✗ Error fetching athletes:`, error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error(`  ✗ Error fetching athletes:`, error.message);
    return [];
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

async function processTeam(teamName, url) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${teamName}`);
  console.log(`${'='.repeat(60)}`);

  const teamId = await getTeamId(teamName);
  if (!teamId) {
    console.log(`⚠ Skipping ${teamName} - not found in database`);
    return { team: teamName, processed: 0, updated: 0, skipped: 0, error: 'Team not found' };
  }

  // Get athletes with missing photos
  const athletesWithMissingPhotos = await getAthletesWithMissingPhotos(teamId);
  console.log(`  Found ${athletesWithMissingPhotos.length} athletes with missing photos`);

  if (athletesWithMissingPhotos.length === 0) {
    console.log(`  ✓ All athletes have photos!`);
    return { team: teamName, processed: 0, updated: 0, skipped: 0 };
  }

  // Scrape the roster page
  const scrapedAthletes = await scrapeTeamRoster(teamName, url);

  // Create a map of scraped athletes by name for fuzzy matching
  const scrapedMap = {};
  scrapedAthletes.forEach(a => {
    if (a.photoUrl) {
      scrapedMap[a.name.toLowerCase()] = normalizePhotoUrl(a.photoUrl, url);
    }
  });

  let updated = 0;
  let skipped = 0;

  // Try to match and update
  for (const athlete of athletesWithMissingPhotos) {
    const normalizedName = athlete.name.toLowerCase();
    const photoUrl = scrapedMap[normalizedName];

    if (photoUrl) {
      const success = await updateAthletePhoto(athlete.id, photoUrl);
      if (success) {
        console.log(`    ✓ Updated photo for ${athlete.name}`);
        updated++;
      }
    } else {
      skipped++;
    }
  }

  const summary = {
    team: teamName,
    processed: athletesWithMissingPhotos.length,
    updated,
    skipped,
  };

  console.log(`\n✓ ${teamName} Summary:`);
  console.log(`  - Athletes with missing photos: ${summary.processed}`);
  console.log(`  - Photos updated: ${summary.updated}`);
  console.log(`  - Could not find photos: ${summary.skipped}`);

  return summary;
}

async function main() {
  console.log('\n🏊 NCAA Swim & Dive Tracker - Photo Update Script');
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
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    console.log(`${status} ${r.team.padEnd(20)} | Updated: ${String(r.updated).padStart(2)} | Missing: ${String(r.processed).padStart(2)}`);
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`Total Athletes With Missing Photos: ${totalProcessed}`);
  console.log(`Total Photos Updated: ${totalUpdated}`);
  console.log(`Could Not Find Photos For: ${totalSkipped}`);
  console.log('-'.repeat(60));
  console.log(`Completed at ${new Date().toISOString()}`);

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
