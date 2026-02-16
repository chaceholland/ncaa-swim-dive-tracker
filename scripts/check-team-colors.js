require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: teams } = await supabase
    .from('teams')
    .select('name, primary_color, secondary_color, conference')
    .order('name')
    .limit(10);

  console.log('\n📊 SAMPLE TEAMS WITH COLORS:\n');
  teams.forEach(team => {
    console.log(`${team.name}:`);
    console.log(`  Primary: ${team.primary_color || 'MISSING'}`);
    console.log(`  Secondary: ${team.secondary_color || 'MISSING'}`);
    console.log(`  Conference: ${team.conference || 'MISSING'}\n`);
  });

  const { data: allTeams } = await supabase.from('teams').select('primary_color, secondary_color');

  const missingColors = allTeams.filter(t => !t.primary_color || !t.secondary_color).length;

  console.log(`Teams with colors: ${allTeams.length - missingColors}/${allTeams.length}`);
  console.log(`Teams missing colors: ${missingColors}`);
}

main();
