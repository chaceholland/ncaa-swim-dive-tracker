require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const teams = ['Purdue', 'Ohio State', 'Wisconsin'];

  for (const teamName of teams) {
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('name', teamName)
      .single();

    if (!team) {
      console.log(`${teamName}: NOT FOUND`);
      continue;
    }

    const { data: imgproxyAthletes } = await supabase
      .from('athletes')
      .select('id')
      .eq('team_id', team.id)
      .like('photo_url', '%imgproxy%');

    const { data: allAthletes } = await supabase
      .from('athletes')
      .select('id')
      .eq('team_id', team.id);

    console.log(`${teamName}: ${imgproxyAthletes.length}/${allAthletes.length} with imgproxy URLs`);
  }
}

main();
