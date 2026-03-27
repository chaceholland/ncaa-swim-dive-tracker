require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('\n🔍 CHECKING PENN STATE PHOTO URLS\n');

  // Get Penn State team
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Penn State')
    .single();

  if (!team) {
    console.log('❌ Penn State team not found');
    return;
  }

  // Get Penn State athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} Penn State athletes\n`);

  let logoCount = 0;
  let headshotCount = 0;
  let nullCount = 0;
  let imgproxyCount = 0;

  athletes.forEach((athlete, index) => {
    if (!athlete.photo_url) {
      nullCount++;
      console.log(`${index + 1}. ${athlete.name}`);
      console.log(`   ❌ [NULL] No photo URL`);
      console.log('');
      return;
    }

    const isLogo = athlete.photo_url === team.logo_url;
    const isImgproxy = athlete.photo_url.includes('/imgproxy/');

    if (isLogo) {
      logoCount++;
    } else {
      headshotCount++;
      if (isImgproxy) {
        imgproxyCount++;
      }
    }

    console.log(`${index + 1}. ${athlete.name}`);
    console.log(`   ${isLogo ? '🏷️  [LOGO]' : (isImgproxy ? '⚠️  [IMGPROXY]' : '✅ [HEADSHOT]')} ${athlete.photo_url.substring(0, 80)}...`);
    console.log('');
  });

  console.log('='.repeat(70));
  console.log(`Summary:`);
  console.log(`  ${headshotCount} with headshots (${imgproxyCount} using imgproxy)`);
  console.log(`  ${logoCount} with team logo`);
  console.log(`  ${nullCount} with NULL photo_url`);
  console.log('='.repeat(70));
}

main();
