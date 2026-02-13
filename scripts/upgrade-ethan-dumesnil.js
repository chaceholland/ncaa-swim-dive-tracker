require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔧 UPGRADING ETHAN DUMESNIL IMAGE QUALITY\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Tennessee')
    .single();

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .ilike('name', '%Ethan Dumesnil%')
    .single();

  console.log(`Current: ${athlete.photo_url}\n`);

  // Upgrade to 1920x1920
  const url = new URL(athlete.photo_url);
  url.searchParams.set('width', '1920');
  url.searchParams.set('height', '1920');

  const newUrl = url.toString();
  console.log(`Upgraded: ${newUrl}\n`);

  await supabase
    .from('athletes')
    .update({ photo_url: newUrl })
    .eq('id', athlete.id);

  console.log('✅ Ethan Dumesnil upgraded to 1920x1920');
}

main();
