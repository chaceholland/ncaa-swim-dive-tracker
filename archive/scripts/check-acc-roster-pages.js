require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeam(teamName) {
  const { data: team } = await supabase
    .from('teams')
    .select('id, roster_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`${teamName}: NOT FOUND`);
    return;
  }

  console.log(`${teamName}:`);
  console.log(`  Roster URL: ${team.roster_url || 'NULL'}`);
}

async function main() {
  console.log('\nACC Teams Roster Pages:\n');
  await checkTeam('SMU');
  await checkTeam('Cal');
  await checkTeam('Stanford');
  await checkTeam('Georgia Tech');
  await checkTeam('Notre Dame');
}

main();
