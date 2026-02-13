require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('\n🔍 CHECKING KENTUCKY PHOTO URLS\n');

  // Get Kentucky team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Kentucky')
    .single();

  if (!team) {
    console.log('❌ Kentucky team not found');
    return;
  }

  // Get Kentucky athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} Kentucky athletes:\n`);

  athletes.forEach((athlete, index) => {
    console.log(`${index + 1}. ${athlete.name}`);
    console.log(`   ${athlete.photo_url}`);
    console.log('');
  });
}

main();
