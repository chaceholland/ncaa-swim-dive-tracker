require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findAthletesWithLogos() {
  console.log('Finding athletes using team logos...\n');

  // Get all teams with their logos
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_url');

  const teamMap = new Map(teams.map(t => [t.id, t]));

  // Get all athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, team_id, profile_url');

  const usingLogos = [];
  const teamCounts = {};

  for (const athlete of athletes) {
    const team = teamMap.get(athlete.team_id);

    // Check if athlete is using team logo
    if (team && athlete.photo_url === team.logo_url) {
      usingLogos.push({
        name: athlete.name,
        teamName: team.name,
        profileUrl: athlete.profile_url,
        id: athlete.id
      });

      teamCounts[team.name] = (teamCounts[team.name] || 0) + 1;
    }
  }

  console.log(`Found ${usingLogos.length} athletes using team logos\n`);

  if (usingLogos.length === 0) {
    console.log('✅ No athletes are using team logos!');
    return;
  }

  console.log('Athletes by team:');
  Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, count]) => {
      console.log(`  ${team}: ${count} athletes`);
    });

  console.log('\nAthletes with profile URLs (could potentially scrape):');
  const withUrls = usingLogos.filter(a => a.profileUrl);
  console.log(`  ${withUrls.length} out of ${usingLogos.length} have profile URLs\n`);

  if (withUrls.length > 0) {
    console.log('Sample athletes with profile URLs:');
    withUrls.slice(0, 10).forEach(a => {
      console.log(`  ${a.name} (${a.teamName})`);
      console.log(`    ${a.profileUrl}`);
    });

    if (withUrls.length > 10) {
      console.log(`  ... and ${withUrls.length - 10} more`);
    }
  }

  console.log('\nAthletes without profile URLs (cannot scrape):');
  const withoutUrls = usingLogos.filter(a => !a.profileUrl);
  console.log(`  ${withoutUrls.length} athletes`);

  if (withoutUrls.length > 0) {
    withoutUrls.slice(0, 5).forEach(a => {
      console.log(`  ${a.name} (${a.teamName})`);
    });
    if (withoutUrls.length > 5) {
      console.log(`  ... and ${withoutUrls.length - 5} more`);
    }
  }
}

findAthletesWithLogos();
