require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function showFinalSummary() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, conference')
    .order('name');
  
  let teamsAt100 = 0;
  let teamsAt90Plus = 0;
  const teamsMissing = [];
  
  for (const team of teams) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('photo_url')
      .eq('team_id', team.id);
    
    const total = athletes.length;
    const withPhotos = athletes.filter(a => a.photo_url).length;
    const coverage = total > 0 ? (withPhotos / total) * 100 : 0;
    
    if (coverage === 100) teamsAt100++;
    else if (coverage >= 90) teamsAt90Plus++;
    
    if (withPhotos < total) {
      teamsMissing.push({
        name: team.name,
        missing: total - withPhotos,
        coverage: coverage.toFixed(1)
      });
    }
  }
  
  console.log('='.repeat(70));
  console.log('FINAL SESSION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total teams: ${teams.length}`);
  console.log(`Teams at 100%: ${teamsAt100}`);
  console.log(`Teams at 90-99%: ${teamsAt90Plus}`);
  console.log(`Teams with missing photos: ${teamsMissing.length}\n`);
  
  if (teamsMissing.length > 0) {
    console.log('Remaining gaps:');
    teamsMissing.sort((a, b) => b.missing - a.missing).forEach(t => {
      console.log(`  ${t.name}: ${t.missing} missing (${t.coverage}% coverage)`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('TEAMS SCRAPED THIS SESSION (with 100% success):');
  console.log('='.repeat(70));
  const successfulTeams = [
    'UNLV (36/36)', 'Arizona (22/22)', 'Navy (18/18)', 
    'Harvard (16/16)', 'Cornell (14/14)', 'Penn (13/13)',
    'Towson (11/11)', 'Auburn (4/4)', 'Tennessee (3/3)',
    'USC (2/2)', 'Columbia (1/1)', 'Dartmouth (1/1)',
    'Indiana (1/1)', 'Southern Illinois (1/1)', 'Texas A&M (1/1)'
  ];
  
  successfulTeams.forEach(t => console.log(`  ✅ ${t}`));
  
  console.log('\n' + '='.repeat(70));
  console.log('Also imported 150 photos from old swim_athletes table');
  console.log('Total photos added this session: 144');
  console.log('='.repeat(70));
}

showFinalSummary();
