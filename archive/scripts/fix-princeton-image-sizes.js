require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔧 Fixing Princeton image sizes...\n');

  // Get Princeton team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .ilike('name', '%princeton%')
    .single();

  console.log('Team:', team.name);

  // Get all Princeton athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id);

  console.log('Athletes:', athletes.length);

  let updated = 0;
  for (const athlete of athletes) {
    if (athlete.photo_url && athlete.photo_url.includes('width=1920&height=1920')) {
      // Replace 1920x1920 with 400x400 for faster loading
      const newUrl = athlete.photo_url.replace(
        'width=1920&height=1920',
        'width=400&height=400'
      );

      const { error } = await supabase
        .from('athletes')
        .update({ photo_url: newUrl })
        .eq('id', athlete.id);

      if (error) {
        console.log('❌ Error updating:', athlete.name, error);
      } else {
        updated++;
        console.log('✅ Updated:', athlete.name);
      }
    }
  }

  console.log('\n✨ Done!');
  console.log('   Updated:', updated, 'athletes');
  console.log('   Images now load much faster!');
}

main().catch(console.error);
