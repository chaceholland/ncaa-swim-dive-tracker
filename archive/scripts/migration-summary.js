require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function showSummary() {
  const { data: athletes, count } = await supabase
    .from('athletes')
    .select('photo_url', { count: 'exact' });
  
  const withPhotos = athletes.filter(a => a.photo_url);
  const storagePhotos = withPhotos.filter(a => a.photo_url.includes('supabase.co/storage'));
  const sidearmPhotos = withPhotos.filter(a => a.photo_url.includes('sidearm'));
  const imgproxyPhotos = withPhotos.filter(a => a.photo_url.includes('imgproxy'));
  
  console.log('='.repeat(60));
  console.log('PHOTO MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total athletes: ${count}`);
  console.log(`With photos: ${withPhotos.length}`);
  console.log(`Without photos: ${count - withPhotos.length}\n`);
  
  console.log('Photo sources:');
  console.log(`  Supabase Storage (migrated): ${storagePhotos.length}`);
  console.log(`  Sidearm (scraped): ${sidearmPhotos.length}`);
  console.log(`  ImgProxy (scraped): ${imgproxyPhotos.length}`);
  console.log('='.repeat(60));
}

showSummary();
