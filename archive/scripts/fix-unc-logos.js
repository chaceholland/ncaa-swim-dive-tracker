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
    .eq('name', 'North Carolina')
    .single();

  // Set all athletes with ACC logos back to team logo
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%ACC_Logo%');

  console.log(`\nSetting ${athletes.length} athletes to use team logo\n`);

  for (const athlete of athletes) {
    await supabase
      .from('athletes')
      .update({ photo_url: team.logo_url })
      .eq('id', athlete.id);
    
    console.log(`✅ ${athlete.name}`);
  }

  console.log(`\nDone. All set to team logo.`);
}

main();
