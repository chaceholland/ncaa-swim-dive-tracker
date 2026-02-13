require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkYears() {
  //  Check old table Yale athletes
  const { data: oldYale } = await supabase
    .from('swim_athletes')
    .select('name, year')
    .eq('team_id', 'yale');
  
  console.log('Yale athletes in old table:');
  oldYale.forEach(a => console.log(`  ${a.name}: "${a.year}"`));
  
  // Check new table values
  const { data: newAthletes } = await supabase
    .from('athletes')
    .select('class_year');
  
  const years = [...new Set(newAthletes.map(a => a.class_year).filter(y => y))];
  console.log('\nclass_year values in new table:');
  years.forEach(y => console.log(`  "${y}"`));
}

checkYears();
