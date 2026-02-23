require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'LSU')
    .single();

  console.log(`Team logo: ${team.logo_url}`);

  // Reset all LSU athletes to team logo — they have no headshots on lsusports.net
  const { data, error } = await supabase
    .from('athletes')
    .update({ photo_url: team.logo_url })
    .eq('team_id', team.id);

  if (error) console.log('Error:', error.message);
  else console.log('Reset all LSU athletes to team logo.');
}

main();
