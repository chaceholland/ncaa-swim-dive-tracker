require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function compareData() {
  const { data: oldAthletes } = await supabase
    .from('swim_athletes')
    .select('name, team_id, headshot_url');
  
  const { data: newAthletes } = await supabase
    .from('athletes')
    .select('name, team_id, photo_url');
  
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, slug');
  
  console.log(`Old table: ${oldAthletes.length} athletes, ${oldAthletes.filter(a => a.headshot_url).length} with photos`);
  console.log(`New table: ${newAthletes.length} athletes, ${newAthletes.filter(a => a.photo_url).length} with photos\n`);
  
  if (teamsError || !teams) {
    console.log('Error fetching teams:', teamsError);
    
    // Just show old table teams with photo counts
    const oldTeamCounts = {};
    oldAthletes.filter(a => a.headshot_url).forEach(a => {
      oldTeamCounts[a.team_id] = (oldTeamCounts[a.team_id] || 0) + 1;
    });
    
    console.log('\nTeams in OLD table with photos:');
    Object.entries(oldTeamCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .forEach(([team, count]) => console.log(`  ${team}: ${count} photos`));
    
    return;
  }
  
  // Continue with comparison...
}

compareData();
