require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeam(teamName) {
  const {data:team} = await supabase.from('teams').select('id').eq('name',teamName).single();
  
  if (!team) {
    console.log(`\n${teamName}: NOT FOUND`);
    return;
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(teamName);
  console.log('='.repeat(70));
  
  const {data:sample} = await supabase.from('athletes').select('name,photo_url').eq('team_id',team.id).not('photo_url','is',null).limit(1).single();
  
  if (sample) {
    console.log(`\nSample (${sample.name}):`);
    console.log(sample.photo_url);
  }
  
  const {data:imgproxy} = await supabase.from('athletes').select('id').eq('team_id',team.id).like('photo_url','%imgproxy%');
  const {data:all} = await supabase.from('athletes').select('id').eq('team_id',team.id);
  
  console.log(`\nImgproxy URLs: ${imgproxy?.length}/${all?.length}`);
}

async function main() {
  await checkTeam('Arizona State');
  await checkTeam('Arizona');
  await checkTeam('TCU');
}

main();
