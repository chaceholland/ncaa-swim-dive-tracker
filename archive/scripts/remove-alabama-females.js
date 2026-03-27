require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const femaleNames = [
  'Ciera Center',
  'Glenda Abonyi-Toth',
  'Mackenzie Brandt',
  'Sydney Blackhurst'
];

async function removeFemales() {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Alabama')
    .single();

  console.log('Removing female athletes from Alabama...\n');

  for (const name of femaleNames) {
    const { error } = await supabase
      .from('athletes')
      .delete()
      .eq('team_id', team.id)
      .eq('name', name);

    if (error) {
      console.log(`  ⚠️  ${name}: ${error.message}`);
    } else {
      console.log(`  ✅ Removed: ${name}`);
    }
  }

  console.log(`\n✅ Complete`);
}

removeFemales();
