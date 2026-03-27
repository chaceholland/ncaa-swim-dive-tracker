require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Complete mapping of old team slugs to new team names
const TEAM_SLUG_TO_NAME = {
  'alabama': 'Alabama',
  'arizona': 'Arizona',
  'arizona-state': 'Arizona State',
  'army': 'Army',
  'auburn': 'Auburn',
  'boston-college': 'Boston College',
  'brown': 'Brown',
  'cal': 'Cal',
  'columbia': 'Columbia',
  'cornell': 'Cornell',
  'dartmouth': 'Dartmouth',
  'duke': 'Duke',
  'florida': 'Florida',
  'florida-state': 'Florida State',
  'george-washington': 'George Washington',
  'georgia': 'Georgia',
  'georgia-tech': 'Georgia Tech',
  'harvard': 'Harvard',
  'indiana': 'Indiana',
  'kentucky': 'Kentucky',
  'louisville': 'Louisville',
  'lsu': 'LSU',
  'michigan': 'Michigan',
  'minnesota': 'Minnesota',
  'missouri': 'Missouri',
  'navy': 'Navy',
  'nc-state': 'NC State',
  'north-carolina': 'North Carolina',
  'northwestern': 'Northwestern',
  'notre-dame': 'Notre Dame',
  'ohio-state': 'Ohio State',
  'penn': 'Penn',
  'penn-state': 'Penn State',
  'pittsburgh': 'Pittsburgh',
  'princeton': 'Princeton',
  'purdue': 'Purdue',
  'south-carolina': 'South Carolina',
  'southern-illinois': 'Southern Illinois',
  'stanford': 'Stanford',
  'tcu': 'TCU',
  'tennessee': 'Tennessee',
  'texas': 'Texas',
  'texas-am': 'Texas A&M',
  'towson': 'Towson',
  'unlv': 'UNLV',
  'usc': 'USC',
  'utah': 'Utah',
  'uva': 'Virginia',
  'virginia-tech': 'Virginia Tech',
  'west-virginia': 'West Virginia',
  'wisconsin': 'Wisconsin',
  'yale': 'Yale'
};

async function migratePhotos() {
  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name');
  
  const teamNameToId = {};
  teams.forEach(t => {
    teamNameToId[t.name] = t.id;
  });
  
  // Get old athletes with photos
  const { data: oldAthletes } = await supabase
    .from('swim_athletes')
    .select('name, team_id, headshot_url')
    .not('headshot_url', 'is', null);
  
  console.log(`Found ${oldAthletes.length} athletes with photos in old table\n`);
  
  let updated = 0;
  let notFound = 0;
  let alreadyHasPhoto = 0;
  let errors = 0;
  
  for (const oldAthlete of oldAthletes) {
    const teamName = TEAM_SLUG_TO_NAME[oldAthlete.team_id];
    if (!teamName) continue;
    
    const teamId = teamNameToId[teamName];
    if (!teamId) continue;
    
    // Find matching athlete in new table
    const { data: newAthlete } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', teamId)
      .eq('name', oldAthlete.name)
      .maybeSingle();
    
    if (!newAthlete) {
      notFound++;
      continue;
    }
    
    if (newAthlete.photo_url) {
      alreadyHasPhoto++;
      continue;
    }
    
    // Update with old photo
    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: oldAthlete.headshot_url })
      .eq('id', newAthlete.id);
    
    if (error) {
      console.error(`Error updating ${oldAthlete.name}: ${error.message}`);
      errors++;
    } else {
      updated++;
      if (updated % 50 === 0) {
        console.log(`Progress: ${updated} photos migrated...`);
      }
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Migration Summary:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Already had photo: ${alreadyHasPhoto}`);
  console.log(`  Not found in new table: ${notFound}`);
  console.log(`  Errors: ${errors}`);
  console.log('='.repeat(60));
}

migratePhotos();
