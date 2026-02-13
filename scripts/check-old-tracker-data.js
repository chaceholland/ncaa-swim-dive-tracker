require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  // Check all tables in public schema
  const { data: tables, error: tablesError } = await supabase.rpc('get_tables');
  
  // Check athletes table
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('id, name, photo_url, team_id')
    .limit(5);
  
  console.log('Athletes table sample:', athletes);
  
  // Check for Auburn specifically
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Auburn')
    .maybeSingle();
  
  if (teams) {
    console.log('\nAuburn team:', teams);
    
    const { data: auburnAthletes } = await supabase
      .from('athletes')
      .select('name, photo_url')
      .eq('team_id', teams.id);
    
    console.log(`\nAuburn has ${auburnAthletes.length} athletes`);
    console.log('With photos:', auburnAthletes.filter(a => a.photo_url).length);
    console.log('\nSample Auburn athletes:');
    auburnAthletes.slice(0, 5).forEach(a => {
      console.log(`  ${a.name}: ${a.photo_url ? 'HAS PHOTO' : 'NO PHOTO'}`);
      if (a.photo_url) console.log(`    ${a.photo_url.substring(0, 80)}`);
    });
  }
}

checkData();
