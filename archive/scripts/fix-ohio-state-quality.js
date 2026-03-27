require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function upgradePhotoQuality(photoUrl) {
  if (!photoUrl) return null;

  // Skip if it's already a team logo
  if (photoUrl.includes('/logos/')) {
    return photoUrl; // Keep team logo as-is
  }

  // Check if it's a sidearmdev crop URL
  if (photoUrl.includes('images.sidearmdev.com/crop')) {
    try {
      const url = new URL(photoUrl);

      // Check if the underlying image is the team logo
      const encodedUrl = url.searchParams.get('url');
      if (encodedUrl && encodedUrl.includes('ohio_state_logo')) {
        return photoUrl; // Keep team logo
      }

      // Upgrade width and height to 1920x1920 for high quality
      url.searchParams.set('width', '1920');
      url.searchParams.set('height', '1920');

      return url.toString();
    } catch (error) {
      console.log(`    ⚠️  Error parsing URL: ${error.message}`);
      return photoUrl;
    }
  }

  return photoUrl;
}

async function main() {
  console.log('\n🔧 FIXING OHIO STATE PHOTO QUALITY');
  console.log('Upgrading photo URLs to higher resolution...\n');

  // Get Ohio State team
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Ohio State')
    .single();

  if (!team) {
    console.log('❌ Ohio State team not found');
    return;
  }

  // Get all Ohio State athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} Ohio State athletes in database\n`);

  let upgraded = 0;
  let skipped = 0;

  for (const athlete of athletes) {
    console.log(`  Processing: ${athlete.name}`);

    if (!athlete.photo_url) {
      console.log(`    ⚠️  No photo URL - skipping`);
      skipped++;
      continue;
    }

    const upgradedUrl = upgradePhotoQuality(athlete.photo_url);

    if (upgradedUrl === athlete.photo_url) {
      console.log(`    ➡️  Kept as-is (team logo or already optimal)`);
      skipped++;
    } else {
      await supabase
        .from('athletes')
        .update({ photo_url: upgradedUrl })
        .eq('id', athlete.id);

      console.log(`    ✅ Upgraded to 1920x1920`);
      upgraded++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ OHIO STATE QUALITY UPGRADE COMPLETE');
  console.log('='.repeat(70));
  console.log(`Upgraded: ${upgraded}/${athletes.length} athletes`);
  console.log(`Skipped: ${skipped} (team logos or no photo)`);
  console.log('');
}

main();
