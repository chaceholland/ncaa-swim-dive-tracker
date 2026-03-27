require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔍 IDENTIFYING: Athletes needing headshots\n');

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .order('name');

  const teamStats = [];

  for (const team of teams) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id);

    const needingPhotos = athletes.filter(a => 
      !a.photo_url || 
      a.photo_url === team.logo_url ||
      a.photo_url.includes('/logos/') ||
      a.photo_url.includes('ACC_Logo')
    );

    if (needingPhotos.length > 0) {
      teamStats.push({
        name: team.name,
        total: athletes.length,
        missing: needingPhotos.length,
        athletes: needingPhotos.map(a => a.name)
      });
    }
  }

  // Sort by most missing
  teamStats.sort((a, b) => b.missing - a.missing);

  console.log(`Found ${teamStats.length} teams with missing headshots:\n`);
  
  teamStats.forEach(team => {
    console.log(`${team.name}: ${team.missing}/${team.total} missing`);
  });

  console.log(`\n\nTotal athletes needing headshots: ${teamStats.reduce((sum, t) => sum + t.missing, 0)}\n`);

  // Save detailed list
  const fs = require('fs');
  fs.writeFileSync('missing-headshots.json', JSON.stringify(teamStats, null, 2));
  console.log('✅ Saved detailed list to missing-headshots.json');
}

main();
