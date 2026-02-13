require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeam(teamName) {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  if (!team) return;

  const { data: athlete } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('team_id', team.id)
    .not('photo_url', 'is', null)
    .limit(1)
    .single();

  if (!athlete) {
    console.log(`\n${teamName}: No photos`);
    return;
  }

  console.log(`\n${teamName} (${athlete.name}):`);
  console.log(athlete.photo_url);
}

async function main() {
  await checkTeam('SMU');
  await checkTeam('Cal');
  await checkTeam('Stanford');
  await checkTeam('Virginia');
  await checkTeam('Virginia Tech');
}

main();
