require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { data: athletes, count } = await supabase
    .from('athletes')
    .select('*', { count: 'exact' });
  
  const withPhotos = athletes.filter(a => a.photo_url).length;
  
  console.log('='.repeat(70));
  console.log('FINAL DATABASE STATUS');
  console.log('='.repeat(70));
  console.log(`Total athletes: ${count}`);
  console.log(`With photos: ${withPhotos} (${((withPhotos/count)*100).toFixed(1)}%)`);
  console.log(`Without photos: ${count - withPhotos}\n`);
  
  // Check SEC teams specifically
  const { data: secTeams } = await supabase
    .from('teams')
    .select('id, name, athlete_count')
    .eq('conference', 'sec')
    .order('name');
  
  console.log('SEC TEAMS (11 total):');
  console.log('='.repeat(70));
  
  let totalSEC = 0;
  for (const team of secTeams) {
    const { data: teamAthletes } = await supabase
      .from('athletes')
      .select('photo_url')
      .eq('team_id', team.id);
    
    const withPhotos = teamAthletes.filter(a => a.photo_url).length;
    totalSEC += teamAthletes.length;
    
    console.log(`  ${team.name.padEnd(20)} ${teamAthletes.length} athletes (${withPhotos} with photos)`);
  }
  
  console.log('='.repeat(70));
  console.log(`Total SEC athletes: ${totalSEC}`);
}

verify();
