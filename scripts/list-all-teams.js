require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: teams } = await supabase
    .from('teams')
    .select('name, roster_url')
    .order('name');

  console.log('\nAll teams in database:\n');
  teams?.forEach(t => {
    console.log(`${t.name}: ${t.roster_url ? 'HAS ROSTER URL' : 'NO ROSTER URL'}`);
  });
}

main();
