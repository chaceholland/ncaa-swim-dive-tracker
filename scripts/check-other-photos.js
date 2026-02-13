require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOthers() {
  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .not('photo_url', 'is', null);
  
  const otherPhotos = athletes.filter(a => 
    !a.photo_url.includes('supabase.co/storage') &&
    !a.photo_url.includes('sidearm') &&
    !a.photo_url.includes('imgproxy')
  );
  
  console.log(`Other photo sources: ${otherPhotos.length}\n`);
  
  const sources = {};
  otherPhotos.forEach(a => {
    try {
      const url = new URL(a.photo_url);
      const domain = url.hostname;
      sources[domain] = (sources[domain] || 0) + 1;
    } catch (e) {
      sources['invalid'] = (sources['invalid'] || 0) + 1;
    }
  });
  
  console.log('Breakdown by domain:');
  Object.entries(sources).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count}`);
  });
}

checkOthers();
