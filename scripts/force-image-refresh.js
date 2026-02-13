require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceImageRefresh() {
  // Get all athletes with Sidearm image URLs
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url');

  const sidearmImages = athletes.filter(a =>
    a.photo_url && a.photo_url.includes('sidearmdev.com')
  );

  console.log(`Found ${sidearmImages.length} Sidearm images\n`);

  let updated = 0;
  for (const athlete of sidearmImages) {
    // Add cache-busting parameter
    const currentUrl = athlete.photo_url;

    // Check if URL already has query parameters
    const separator = currentUrl.includes('?') ? '&' : '?';
    const newUrl = `${currentUrl}${separator}v=${Date.now()}`;

    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: newUrl })
      .eq('id', athlete.id);

    if (!error) {
      updated++;
      if (updated % 10 === 0) {
        console.log(`Updated ${updated}/${sidearmImages.length}...`);
      }
    }
  }

  console.log(`\n✅ Added cache-busting parameter to ${updated} images`);
  console.log('Images will now reload fresh from the server!');
}

forceImageRefresh();
