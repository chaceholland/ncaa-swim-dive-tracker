require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRemaining() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, conference')
    .order('name');
  
  const teamStats = [];
  
  for (const team of teams) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('photo_url')
      .eq('team_id', team.id);
    
    const total = athletes.length;
    const withPhotos = athletes.filter(a => a.photo_url).length;
    const missing = total - withPhotos;
    
    if (missing > 0) {
      teamStats.push({
        name: team.name,
        conference: team.conference,
        total,
        withPhotos,
        missing,
        coverage: ((withPhotos / total) * 100).toFixed(1)
      });
    }
  }
  
  teamStats.sort((a, b) => b.missing - a.missing);
  
  console.log('='.repeat(70));
  console.log('TEAMS STILL NEEDING PHOTOS');
  console.log('='.repeat(70));
  
  teamStats.forEach(t => {
    console.log(`${t.name.padEnd(25)} ${t.missing.toString().padStart(2)} missing (${t.withPhotos}/${t.total}, ${t.coverage}%)`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log(`Total teams with missing photos: ${teamStats.length}`);
  console.log(`Total photos still needed: ${teamStats.reduce((sum, t) => sum + t.missing, 0)}`);
}

checkRemaining();
