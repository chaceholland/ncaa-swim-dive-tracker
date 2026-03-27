require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllPixelatedImages() {
  const { data: allAthletes } = await supabase
    .from('athletes')
    .select('id, name, team_id, photo_url');

  const pixelated = allAthletes.filter(a =>
    a.photo_url && a.photo_url.includes('width=100&height=100')
  );

  console.log(`Found ${pixelated.length} athletes with pixelated images\n`);

  if (pixelated.length === 0) {
    console.log('All headshots are high quality!');
    return;
  }

  let fixed = 0;
  for (const athlete of pixelated) {
    const newUrl = athlete.photo_url.replace('width=100&height=100', 'width=800&height=800');

    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: newUrl })
      .eq('id', athlete.id);

    if (!error) {
      fixed++;
    }
  }

  console.log(`✅ Fixed ${fixed}/${pixelated.length} pixelated headshots`);
}

fixAllPixelatedImages();
