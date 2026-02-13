require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEAM_SLUG_TO_NAME = {
  'alabama': 'Alabama',
  'boston-college': 'Boston College',
  'duke': 'Duke',
  'florida-state': 'Florida State',
  'georgia': 'Georgia',
  'georgia-tech': 'Georgia Tech',
  'kentucky': 'Kentucky',
  'louisville': 'Louisville',
  'lsu': 'LSU',
  'missouri': 'Missouri',
  'nc-state': 'NC State',
  'north-carolina': 'North Carolina',
  'notre-dame': 'Notre Dame',
  'ohio-state': 'Ohio State',
  'pittsburgh': 'Pittsburgh',
  'purdue': 'Purdue',
  'south-carolina': 'South Carolina',
  'tcu': 'TCU',
  'uva': 'Virginia',
  'virginia-tech': 'Virginia Tech',
  'yale': 'Yale',
  'smu': 'SMU'
};

async function importMissingAthletes() {
  console.log('Importing athletes from swim_athletes table for teams with zero athletes...\n');
  
  // Get teams with zero athlete_count
  const { data: zeroTeams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('athlete_count', 0);
  
  if (!zeroTeams || zeroTeams.length === 0) {
    console.log('No teams with zero athletes found!');
    return;
  }
  
  console.log(`Found ${zeroTeams.length} teams with zero athletes\n`);
  
  // Create team name to ID mapping
  const teamNameToId = {};
  zeroTeams.forEach(t => {
    teamNameToId[t.name] = t.id;
  });
  
  let totalImported = 0;
  let teamsUpdated = 0;
  
  for (const [slug, teamName] of Object.entries(TEAM_SLUG_TO_NAME)) {
    const teamId = teamNameToId[teamName];
    if (!teamId) continue;
    
    console.log(`\nProcessing ${teamName}...`);
    
    // Get athletes from old table
    const { data: oldAthletes } = await supabase
      .from('swim_athletes')
      .select('*')
      .eq('team_id', slug);
    
    if (!oldAthletes || oldAthletes.length === 0) {
      console.log(`  No athletes found in old table`);
      continue;
    }
    
    console.log(`  Found ${oldAthletes.length} athletes in old table`);
    
    let imported = 0;
    
    for (const oldAthlete of oldAthletes) {
      // Import to new athletes table
      // Map old year values to new format (lowercase)
      const yearMap = {
        'Freshman': 'freshman',
        'Sophomore': 'sophomore',
        'Junior': 'junior',
        'Senior': 'senior',
        '5th Year': 'fifth-year',
        'Graduate': 'graduate'
      };

      const { error } = await supabase
        .from('athletes')
        .insert({
          team_id: teamId,
          name: oldAthlete.name,
          athlete_type: (oldAthlete.athlete_type || 'swimmer').toLowerCase(),
          class_year: yearMap[oldAthlete.year] || null,
          hometown: oldAthlete.hometown,
          photo_url: oldAthlete.headshot_url,
          profile_url: oldAthlete.roster_url,
        });
      
      if (!error) {
        imported++;
      } else {
        console.log(`    Error importing ${oldAthlete.name}: ${error.message}`);
      }
    }
    
    console.log(`  ✅ Imported ${imported}/${oldAthletes.length} athletes`);
    
    // Update team athlete_count
    await supabase
      .from('teams')
      .update({ athlete_count: imported })
      .eq('id', teamId);
    
    totalImported += imported;
    if (imported > 0) teamsUpdated++;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(70));
  console.log(`Teams updated: ${teamsUpdated}`);
  console.log(`Total athletes imported: ${totalImported}`);
}

importMissingAthletes();
