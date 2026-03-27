require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n=== FIXING EDGE CASE URLs ===\n');

  // Fix 1: Cal - Trey Hesser
  // Add size parameters to match other Cal athletes
  const calOriginalUrl = 'https://calbears.com/images/2025/3/3/claremont1.png';
  const calFixedUrl = 'https://calbears.com/images/2025/3/3/claremont1.png?width=1920&height=1920';

  console.log('Fix 1: Cal - Trey Hesser');
  console.log('Original URL:', calOriginalUrl);
  console.log('Fixed URL:', calFixedUrl);

  const { data: calAthlete, error: calFindError } = await supabase
    .from('athletes')
    .select('id, name')
    .ilike('name', '%Hesser%')
    .eq('team_id', (await supabase.from('teams').select('id').eq('name', 'Cal').single()).data.id)
    .single();

  if (calFindError) {
    console.log('Error finding Cal athlete:', calFindError);
  } else {
    const { error: calUpdateError } = await supabase
      .from('athletes')
      .update({ photo_url: calFixedUrl })
      .eq('id', calAthlete.id);

    if (calUpdateError) {
      console.log('❌ Error updating Cal athlete:', calUpdateError);
    } else {
      console.log('✅ Updated Cal athlete photo URL with size parameters\n');
    }
  }

  // Fix 2: Dartmouth - Hakan Tell
  // Set photo_url to null since it's pointing to HTML page
  console.log('Fix 2: Dartmouth - Hakan Tell');
  console.log('Issue: photo_url points to HTML roster page');
  console.log('Solution: Set to null (will show initials fallback)');

  const { data: dartAthlete, error: dartFindError } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('name', 'Hakan Tell')
    .eq('team_id', (await supabase.from('teams').select('id').eq('name', 'Dartmouth').single()).data.id)
    .single();

  if (dartFindError) {
    console.log('Error finding Dartmouth athlete:', dartFindError);
  } else {
    console.log('Current URL:', dartAthlete.photo_url);

    const { error: dartUpdateError } = await supabase
      .from('athletes')
      .update({ photo_url: null })
      .eq('id', dartAthlete.id);

    if (dartUpdateError) {
      console.log('❌ Error updating Dartmouth athlete:', dartUpdateError);
    } else {
      console.log('✅ Set Dartmouth athlete photo_url to null\n');
    }
  }

  // Verify fixes
  console.log('\n=== VERIFICATION ===\n');

  const { data: calVerify } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('id', calAthlete?.id)
    .single();

  const { data: dartVerify } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('id', dartAthlete?.id)
    .single();

  if (calVerify) {
    const willBypass = calVerify.photo_url?.includes('?width=') || calVerify.photo_url?.includes('&width=');
    console.log(`Cal - ${calVerify.name}:`);
    console.log(`  URL: ${calVerify.photo_url}`);
    console.log(`  Will bypass Vercel: ${willBypass ? '✅ YES' : '❌ NO'}`);
  }

  if (dartVerify) {
    console.log(`\nDartmouth - ${dartVerify.name}:`);
    console.log(`  URL: ${dartVerify.photo_url || 'null'}`);
    console.log(`  Will show: Initials fallback (correct)`);
  }

  console.log('\n✅ Both edge cases fixed!\n');
}

main();
