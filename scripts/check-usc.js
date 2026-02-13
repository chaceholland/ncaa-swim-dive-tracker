require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUSC() {
  // Get USC team
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .ilike('name', '%USC%')
    .single();

  console.log('USC Team:', JSON.stringify(team, null, 2));

  if (team) {
    // Get athletes
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url, athlete_type')
      .eq('team_id', team.id)
      .order('name');

    console.log('\nUSC Athletes:');
    athletes.forEach(a => {
      const status = a.photo_url ? '✓' : '✗';
      console.log(`${status} ${a.name} (${a.athlete_type}): ${a.photo_url || 'NO PHOTO'}`);
    });

    const withoutPhotos = athletes.filter(a => !a.photo_url);
    console.log(`\nTotal: ${athletes.length}, Without photos: ${withoutPhotos.length}`);
  }
}

checkUSC().catch(console.error);
