require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkZeroCounts() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, conference, athlete_count')
    .order('name');
  
  console.log('='.repeat(70));
  console.log('TEAMS WITH ZERO OR NULL ATHLETE COUNTS');
  console.log('='.repeat(70));
  
  const zeroTeams = teams.filter(t => !t.athlete_count || t.athlete_count === 0);
  
  if (zeroTeams.length === 0) {
    console.log('All teams have athlete counts > 0');
  } else {
    console.log(`\nFound ${zeroTeams.length} teams with zero/null athlete counts:\n`);
    zeroTeams.forEach(t => {
      console.log(`  ${t.name} (${t.conference.toUpperCase()}) - athlete_count: ${t.athlete_count}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('SEC TEAMS STATUS');
  console.log('='.repeat(70));
  
  const secTeams = teams.filter(t => t.conference === 'sec');
  secTeams.forEach(t => {
    // Check actual athlete count
    const checkAthletes = async () => {
      const { data: athletes } = await supabase
        .from('athletes')
        .select('id')
        .eq('team_id', t.id);
      
      console.log(`  ${t.name.padEnd(20)} - DB count: ${t.athlete_count || 0}, Actual: ${athletes?.length || 0}`);
    };
    checkAthletes();
  });
}

checkZeroCounts();
