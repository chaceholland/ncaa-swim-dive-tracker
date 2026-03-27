require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Purdue')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, profile_url')
    .eq('team_id', team.id)
    .not('profile_url', 'is', null)
    .limit(1);

  console.log('Sample Purdue athlete:');
  console.log(`Name: ${athletes[0].name}`);
  console.log(`Profile URL: ${athletes[0].profile_url}`);
}

main();
