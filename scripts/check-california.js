require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCalifornia() {
  // Get California team
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .ilike('name', '%California%')
    .or('name.eq.California,name.eq.Cal,name.ilike.%Berkeley%')
    .maybeSingle();

  console.log('California Team:', JSON.stringify(team, null, 2));

  if (team) {
    // Get athletes
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url, athlete_type')
      .eq('team_id', team.id)
      .order('name');

    console.log('\nCalifornia Athletes:');
    athletes.forEach(a => {
      const status = a.photo_url ? '✓' : '✗';
      const url = a.photo_url ? a.photo_url.substring(0, 60) + '...' : 'NO PHOTO';
      console.log(`${status} ${a.name} (${a.athlete_type}): ${url}`);
    });

    const withoutPhotos = athletes.filter(a => !a.photo_url);
    const withBadPhotos = athletes.filter(a =>
      a.photo_url && (a.photo_url.includes('dummy') || a.photo_url.includes('placeholder'))
    );

    console.log(`\nTotal: ${athletes.length}`);
    console.log(`Without photos: ${withoutPhotos.length}`);
    console.log(`With bad photos: ${withBadPhotos.length}`);

    if (withoutPhotos.length > 0) {
      console.log('\nAthletes without photos:');
      withoutPhotos.forEach(a => console.log(`  - ${a.name}`));
    }
  }
}

checkCalifornia().catch(console.error);
