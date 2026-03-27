require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔧 Fixing Purdue URLs - removing proxy, using direct Google Storage URLs\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Purdue')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id);

  console.log(`Found ${athletes.length} Purdue athletes\n`);

  let updated = 0;
  for (const athlete of athletes) {
    if (athlete.photo_url && athlete.photo_url.includes('images.weserv.nl')) {
      // Extract the original Google Storage URL from the weserv.nl proxy URL
      const match = athlete.photo_url.match(/url=([^&]+)/);
      if (match) {
        const originalUrl = decodeURIComponent(match[1]);

        const { error } = await supabase
          .from('athletes')
          .update({ photo_url: originalUrl })
          .eq('id', athlete.id);

        if (error) {
          console.log('❌ Error updating:', athlete.name, error);
        } else {
          updated++;
          console.log('✅ Updated:', athlete.name);
        }
      }
    }
  }

  console.log('\n✨ Done!');
  console.log('   Updated:', updated, 'athletes');
  console.log('   Next.js will now handle image optimization automatically');
}

main().catch(console.error);
