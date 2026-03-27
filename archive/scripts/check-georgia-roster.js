require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGeorgia() {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Georgia')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, class_year')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Georgia team currently has ${athletes.length} athletes in database:\n`);
  console.log('Name'.padEnd(35) + 'Class Year');
  console.log('='.repeat(50));
  
  athletes.forEach(a => {
    console.log(`${a.name.padEnd(35)}${a.class_year || 'Unknown'}`);
  });
}

checkGeorgia();
