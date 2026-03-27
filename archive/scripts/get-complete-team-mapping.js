require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createMapping() {
  const { data: oldAthletes } = await supabase
    .from('swim_athletes')
    .select('team_id')
    .not('headshot_url', 'is', null);
  
  const { data: teams } = await supabase
    .from('teams')
    .select('name');
  
  const uniqueSlugs = [...new Set(oldAthletes.map(a => a.team_id))].sort();
  const teamNames = teams.map(t => t.name).sort();
  
  console.log('Old table team slugs:');
  uniqueSlugs.forEach(slug => console.log(`  '${slug}': '',`));
  
  console.log('\nNew table team names:');
  teamNames.forEach(name => console.log(`  ${name}`));
}

createMapping();
