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
    .eq('name', 'Stanford')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log('Stanford Team Logo:', team.logo_url);
  console.log('\nTotal athletes:', athletes.length);

  const withLogos = athletes.filter(a => a.photo_url === team.logo_url || a.photo_url.includes('logo'));
  const withHeadshots = athletes.filter(a => a.photo_url !== team.logo_url && !a.photo_url.includes('logo'));

  console.log('With team logos:', withLogos.length);
  console.log('With headshots:', withHeadshots.length);

  console.log('\nSample headshot URLs:');
  withHeadshots.slice(0, 5).forEach(a => {
    console.log(`  ${a.name}:`);
    console.log(`    ${a.photo_url}\n`);
  });
}

main();
