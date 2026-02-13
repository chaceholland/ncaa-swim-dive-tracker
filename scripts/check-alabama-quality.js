require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlabama() {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Alabama')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log('Alabama Athletes - Current Image Quality:\n');
  console.log('Name'.padEnd(25) + 'Quality'.padEnd(20) + 'Source');
  console.log('='.repeat(70));

  athletes.forEach(a => {
    if (a.photo_url) {
      const whMatch = a.photo_url.match(/width=(\d+)&height=(\d+)/);
      const singleMatch = a.photo_url.match(/[?&](?:w|width|h|height)=(\d+)/);

      let quality = 'Unknown';
      if (whMatch) {
        const size = parseInt(whMatch[1]);
        quality = size >= 1000 ? `✅ High (${size}px)` : size >= 400 ? `⚠️  Med (${size}px)` : `❌ Low (${size}px)`;
      } else if (singleMatch) {
        const size = parseInt(singleMatch[1]);
        quality = size >= 1000 ? `✅ High (${size}px)` : size >= 400 ? `⚠️  Med (${size}px)` : `❌ Low (${size}px)`;
      } else {
        quality = '📁 Static file';
      }

      const source = a.photo_url.includes('sidearmdev') ? 'Sidearm' :
                     a.photo_url.includes('supabase') ? 'Supabase' :
                     a.photo_url.includes('rolltide') ? 'RollTide' : 'Other';

      console.log(`${a.name.padEnd(25)}${quality.padEnd(20)}${source}`);
    } else {
      console.log(`${a.name.padEnd(25)}❌ No photo`);
    }
  });

  console.log('\n' + '='.repeat(70));
  const withPhotos = athletes.filter(a => a.photo_url).length;
  const highQuality = athletes.filter(a => {
    if (!a.photo_url) return false;
    const match = a.photo_url.match(/(?:width|w|height|h)=(\d+)/);
    return match && parseInt(match[1]) >= 1000;
  }).length;

  console.log(`Total: ${athletes.length} athletes`);
  console.log(`With photos: ${withPhotos}`);
  console.log(`High quality (1000px+): ${highQuality}`);
}

checkAlabama();
