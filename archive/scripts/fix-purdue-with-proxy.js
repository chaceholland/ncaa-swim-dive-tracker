require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔧 Fixing Purdue images with proxy service...\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .ilike('name', '%purdue%')
    .single();

  console.log('Team:', team.name);

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id);

  console.log('Athletes:', athletes.length, '\n');

  let updated = 0;
  for (const athlete of athletes) {
    if (athlete.photo_url && athlete.photo_url.includes('storage.googleapis.com')) {
      // Remove any existing query params
      const baseUrl = athlete.photo_url.split('?')[0];

      // Use weserv.nl image proxy for resizing
      const newUrl = `https://images.weserv.nl/?url=${encodeURIComponent(baseUrl)}&w=400&h=400&fit=cover&output=webp`;

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
  console.log('   Images now use optimized proxy URLs');
}

main().catch(console.error);
