require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔧 Fixing Purdue image sizes...\n');

  // Get Purdue team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .ilike('name', '%purdue%')
    .single();

  console.log('Team:', team.name);

  // Get all Purdue athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id);

  console.log('Athletes:', athletes.length);

  let updated = 0;
  for (const athlete of athletes) {
    if (athlete.photo_url && athlete.photo_url.includes('storage.googleapis.com') && !athlete.photo_url.includes('?')) {
      // Add width and height parameters for faster loading
      const newUrl = athlete.photo_url + '?width=400&height=400';

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
