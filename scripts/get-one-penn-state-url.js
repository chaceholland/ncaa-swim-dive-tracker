require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Penn State')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%imgproxy%')
    .limit(1);

  console.log('Full URL:');
  console.log(athletes[0].photo_url);
}

main();
