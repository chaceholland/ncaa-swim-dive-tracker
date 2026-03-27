require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTypes() {
  // Check old table
  const { data: oldAthletes } = await supabase
    .from('swim_athletes')
    .select('athlete_type');
  
  const oldTypes = [...new Set(oldAthletes.map(a => a.athlete_type))];
  console.log('Old table athlete_type values:');
  oldTypes.forEach(t => console.log(`  "${t}"`));
  
  // Check new table
  const { data: newAthletes } = await supabase
    .from('athletes')
    .select('athlete_type')
    .limit(100);
  
  const newTypes = [...new Set(newAthletes.map(a => a.athlete_type))];
  console.log('\nNew table athlete_type values:');
  newTypes.forEach(t => console.log(`  "${t}"`));
}

checkTypes();
