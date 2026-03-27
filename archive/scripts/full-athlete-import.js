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
  'yale': 'Yale'
};

async function fullImport() {
  console.log('Full import of ALL athletes from swim_athletes table...\n');
  
  // Get team name to ID mapping
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name');
  
  const teamNameToId = {};
  teams.forEach(t => {
    teamNameToId[t.name] = t.id;
  });
  
  let totalImported = 0;
  let totalSkipped = 0;
  let teamsUpdated = 0;
  
  for (const [slug, teamName] of Object.entries(TEAM_SLUG_TO_NAME)) {
    const teamId = teamNameToId[teamName];
    if (!teamId) {
      console.log(`\n❌ Team not found: ${teamName}`);
      continue;
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${teamName}`);
    console.log('='.repeat(60));
    
    // Get ALL athletes from old table
    const { data: oldAthletes } = await supabase
      .from('swim_athletes')
      .select('*')
      .eq('team_id', slug);
    
    if (!oldAthletes || oldAthletes.length === 0) {
      console.log(`  No athletes in old table`);
      continue;
    }
    
    console.log(`  Old table: ${oldAthletes.length} athletes`);
    
    // Get existing athletes in new table
    const { data: existingAthletes } = await supabase
      .from('athletes')
      .select('name')
      .eq('team_id', teamId);
    
    const existingNames = new Set(existingAthletes.map(a => a.name));
    console.log(`  New table: ${existingAthletes.length} athletes already exist`);
    
    let imported = 0;
    let skipped = 0;
    
    // Year mapping
    const yearMap = {
      'Freshman': 'freshman',
      'Sophomore': 'sophomore',
      'Junior': 'junior',
      'Senior': 'senior',
      '5th Year': 'fifth-year',
      'Graduate': 'graduate'
    };
    
    for (const oldAthlete of oldAthletes) {
      // Skip if already exists
      if (existingNames.has(oldAthlete.name)) {
        skipped++;
        continue;
      }
      
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
    
    const newTotal = existingAthletes.length + imported;
    
    // Update team athlete_count
    await supabase
      .from('teams')
      .update({ athlete_count: newTotal })
      .eq('id', teamId);
    
    console.log(`  ✅ Imported: ${imported}, Skipped: ${skipped}, Total now: ${newTotal}`);
    
    totalImported += imported;
    totalSkipped += skipped;
    if (imported > 0) teamsUpdated++;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('FULL IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Teams updated: ${teamsUpdated}`);
  console.log(`Total athletes imported: ${totalImported}`);
  console.log(`Total athletes skipped (already exist): ${totalSkipped}`);
}

fullImport();
