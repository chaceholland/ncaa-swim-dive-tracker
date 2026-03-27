require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔍 FINDING: Teams using only team logos\n');

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .order('name');

  const teamLogoOnlyTeams = [];

  for (const team of teams) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id);

    if (!athletes || athletes.length === 0) continue;

    const allUsingLogos = athletes.every(a =>
      !a.photo_url ||
      a.photo_url === team.logo_url ||
      a.photo_url.includes('/logos/')
    );

    if (allUsingLogos) {
      teamLogoOnlyTeams.push({
        name: team.name,
        count: athletes.length
      });
    }
  }

  console.log(`Found ${teamLogoOnlyTeams.length} teams using only team logos:\n`);

  teamLogoOnlyTeams.forEach(team => {
    console.log(`  ${team.name}: ${team.count} athletes`);
  });

  console.log(`\nTotal athletes: ${teamLogoOnlyTeams.reduce((sum, t) => sum + t.count, 0)}`);
}

main();
