require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkACCTeams() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, athlete_count')
    .eq('conference', 'acc')
    .order('name');

  console.log('ACC Teams:\n');
  teams.forEach(t => {
    console.log(`- ${t.name} (ID: ${t.id}, ${t.athlete_count} athletes)`);
  });
  console.log(`\nTotal ACC teams: ${teams.length}`);

  return teams;
}

checkACCTeams().catch(console.error);
