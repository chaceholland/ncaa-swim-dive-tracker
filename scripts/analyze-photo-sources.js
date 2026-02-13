require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzePhotos() {
  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url, team_id')
    .not('photo_url', 'is', null);
  
  console.log(`Total athletes with photos: ${athletes.length}\n`);
  
  // Categorize by photo source
  const storagePhotos = athletes.filter(a => a.photo_url.includes('supabase.co/storage'));
  const imgproxyPhotos = athletes.filter(a => a.photo_url.includes('imgproxy'));
  const sidearmPhotos = athletes.filter(a => a.photo_url.includes('sidearm'));
  const otherPhotos = athletes.filter(a => 
    !a.photo_url.includes('supabase.co/storage') && 
    !a.photo_url.includes('imgproxy') &&
    !a.photo_url.includes('sidearm')
  );
  
  console.log('Photo sources:');
  console.log(`  Supabase Storage: ${storagePhotos.length}`);
  console.log(`  ImgProxy: ${imgproxyPhotos.length}`);
  console.log(`  Sidearm: ${sidearmPhotos.length}`);
  console.log(`  Other: ${otherPhotos.length}`);
  
  // Sample storage photos
  if (storagePhotos.length > 0) {
    console.log('\nSample Supabase Storage photos:');
    storagePhotos.slice(0, 5).forEach(a => {
      console.log(`  ${a.name}: ${a.photo_url}`);
    });
  }
}

analyzePhotos();
