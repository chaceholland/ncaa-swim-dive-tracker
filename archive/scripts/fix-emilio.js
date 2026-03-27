require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixEmilio() {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name, photo_url, team_id')
    .eq('name', 'Emilio Trevino Laureano')
    .single();

  console.log('Emilio Trevino Laureano:');
  console.log('  Photo URL:', athlete.photo_url || 'NONE');

  const { data: team } = await supabase
    .from('teams')
    .select('name, logo_url')
    .eq('id', athlete.team_id)
    .single();

  console.log('  Team:', team.name);
  console.log('  Team Logo:', team.logo_url || 'NONE');

  if (!athlete.photo_url && team.logo_url) {
    await supabase
      .from('athletes')
      .update({ photo_url: team.logo_url })
      .eq('id', athlete.id);

    console.log('\n✅ Updated to use team logo');
  } else if (!athlete.photo_url && !team.logo_url) {
    console.log('\n❌ No team logo available');
  } else {
    console.log('\n✓ Already has photo');
  }
}

fixEmilio();
