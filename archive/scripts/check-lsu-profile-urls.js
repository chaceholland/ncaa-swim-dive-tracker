require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔗 CHECKING: LSU Profile URLs\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'LSU')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, profile_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Total LSU athletes: ${athletes.length}\n`);

  const withUrls = athletes.filter(a => a.profile_url);
  const withoutUrls = athletes.filter(a => !a.profile_url);

  console.log(`With profile URLs: ${withUrls.length}`);
  console.log(`Without profile URLs: ${withoutUrls.length}\n`);

  if (withoutUrls.length > 0) {
    console.log('Athletes missing profile URLs:');
    withoutUrls.forEach(a => console.log(`  - ${a.name}`));
  }

  if (withUrls.length > 0) {
    console.log('\nSample profile URLs:');
    withUrls.slice(0, 5).forEach(a => {
      console.log(`  ${a.name}: ${a.profile_url}`);
    });
  }
}

main();
