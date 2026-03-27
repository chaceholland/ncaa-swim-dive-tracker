require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCal() {
  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('team_id', 'f9deceb5-42db-46e8-aab1-6b8dab2bfd0c')
    .order('name');

  console.log('Cal Athletes Photo Status:\n');
  let withPhotos = 0;
  let without = 0;

  athletes.forEach(a => {
    if (a.photo_url) {
      console.log(`✓ ${a.name}`);
      withPhotos++;
    } else {
      console.log(`✗ ${a.name}`);
      without++;
    }
  });

  console.log(`\nSummary: ${withPhotos} with photos, ${without} without`);
}

checkCal();
