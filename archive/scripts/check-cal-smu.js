require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeam(teamName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`CHECKING: ${teamName}`);
  console.log('='.repeat(70));

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`❌ Team "${teamName}" not found`);
    return;
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url, profile_url')
    .eq('team_id', team.id)
    .limit(5);

  console.log(`\nFound ${athletes?.length} sample athletes:\n`);
  athletes?.forEach(a => {
    console.log(`${a.name}:`);
    console.log(`  Photo: ${a.photo_url ? a.photo_url.substring(0, 100) : 'NULL'}...`);
    console.log(`  Profile: ${a.profile_url || 'NULL'}\n`);
  });

  // Count imgproxy URLs
  const { data: imgproxyAthletes } = await supabase
    .from('athletes')
    .select('id')
    .eq('team_id', team.id)
    .like('photo_url', '%imgproxy%');

  const { data: nullAthletes } = await supabase
    .from('athletes')
    .select('id')
    .eq('team_id', team.id)
    .is('photo_url', null);

  const { data: allAthletes } = await supabase
    .from('athletes')
    .select('id')
    .eq('team_id', team.id);

  console.log(`Total athletes: ${allAthletes?.length}`);
  console.log(`Imgproxy URLs: ${imgproxyAthletes?.length}`);
  console.log(`NULL photo URLs: ${nullAthletes?.length}`);
}

async function main() {
  await checkTeam('California');
  await checkTeam('SMU');
}

main();
