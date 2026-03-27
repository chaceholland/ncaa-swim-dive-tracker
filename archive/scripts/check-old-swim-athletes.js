require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOldData() {
  // Query swim_athletes table
  const { data: oldAthletes, error, count } = await supabase
    .from('swim_athletes')
    .select('*', { count: 'exact' })
    .limit(5);
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log(`Total swim_athletes: ${count}\n`);
  console.log('Sample data:', JSON.stringify(oldAthletes, null, 2));
  
  // Check Auburn in old table
  const { data: auburnOld } = await supabase
    .from('swim_athletes')
    .select('name, headshot_url')
    .eq('team_id', '3dc2371f-b2b8-41ae-994c-eb8089efd4ee');
  
  console.log(`\nAuburn in swim_athletes: ${auburnOld.length} athletes`);
  const withPhotos = auburnOld.filter(a => a.headshot_url);
  console.log(`With headshots: ${withPhotos.length}`);
  
  if (withPhotos.length > 0) {
    console.log('\nSample Auburn photos from old table:');
    withPhotos.slice(0, 5).forEach(a => {
      console.log(`  ${a.name}`);
      console.log(`    ${a.headshot_url}`);
    });
  }
}

checkOldData();
