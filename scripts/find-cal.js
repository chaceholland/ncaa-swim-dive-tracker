require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Search for teams with Cal in the name
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .or('name.ilike.%cal%,name.ilike.%berkeley%')
    .order('name');

  console.log('\nTeams matching "Cal" or "Berkeley":');
  teams?.forEach(t => console.log(`  - ${t.name}`));

  // Also get a full SMU photo URL
  console.log('\n' + '='.repeat(70));
  console.log('SMU FULL PHOTO URL:');
  console.log('='.repeat(70));

  const { data: smuTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'SMU')
    .single();

  const { data: smuAthlete } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('team_id', smuTeam.id)
    .limit(1)
    .single();

  console.log(`\n${smuAthlete.name}:`);
  console.log(smuAthlete.photo_url);
}

main();
