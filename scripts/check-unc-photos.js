require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'North Carolina')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log('\n📸 North Carolina Athlete Photos:\n');
  athletes.forEach(a => {
    const isSupabase = a.photo_url?.includes('supabase.co/storage');
    const isHighRes = a.photo_url?.includes('width=1920');
    console.log(`${a.name}:`);
    console.log(`  ${a.photo_url}`);
    console.log(`  Supabase: ${isSupabase}, High-res: ${isHighRes}\n`);
  });
}

main();
