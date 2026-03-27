require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function fixCropUrl(photoUrl) {
  if (!photoUrl || !photoUrl.includes('images.sidearmdev.com/crop')) {
    return photoUrl;
  }

  try {
    const url = new URL(photoUrl);
    
    // Change from square crop (1600x1600) to portrait crop (1200x1600)
    // This will show more of the head without cutting off the top
    url.searchParams.set('width', '1200');
    url.searchParams.set('height', '1600');
    
    return url.toString();
  } catch (error) {
    return photoUrl;
  }
}

async function main() {
  console.log('\n🔧 FIXING PRINCETON HEADSHOT CROPS');
  console.log('Adjusting from square to portrait crops...\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Princeton')
    .single();

  if (!team) {
    console.log('❌ Princeton not found');
    return;
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%crop%')
    .order('name');

  console.log(`Found ${athletes.length} athletes with crop URLs\n`);

  let updated = 0;

  for (const athlete of athletes) {
    const newUrl = fixCropUrl(athlete.photo_url);
    
    if (newUrl !== athlete.photo_url) {
      console.log(`  ${athlete.name}`);
      console.log(`    Before: ${athlete.photo_url.substring(0, 80)}...`);
      console.log(`    After:  ${newUrl.substring(0, 80)}...`);
      
      await supabase
        .from('athletes')
        .update({ photo_url: newUrl })
        .eq('id', athlete.id);
      
      console.log(`    ✅ Updated\n`);
      updated++;
    }
  }

  console.log('='.repeat(70));
  console.log(`✅ PRINCETON CROPS FIXED: ${updated}/${athletes.length} athletes`);
  console.log('='.repeat(70));
}

main();
