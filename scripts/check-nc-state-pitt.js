require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTeam(teamName) {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name')
    .limit(5);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`${teamName.toUpperCase()}`);
  console.log('='.repeat(70));

  for (const athlete of athletes) {
    console.log(`\n${athlete.name}:`);
    console.log(`  ${athlete.photo_url}`);

    // Check if it's a crop URL with dimensions
    if (athlete.photo_url.includes('crop') && athlete.photo_url.includes('width=')) {
      const widthMatch = athlete.photo_url.match(/width=(\d+)/);
      const heightMatch = athlete.photo_url.match(/height=(\d+)/);
      if (widthMatch && heightMatch) {
        console.log(`  Current size: ${widthMatch[1]}x${heightMatch[1]}`);
      }
    }
  }
}

async function main() {
  await checkTeam('NC State');
  await checkTeam('Pittsburgh');
}

main();
