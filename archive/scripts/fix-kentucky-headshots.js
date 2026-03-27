require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function decodeImgproxyUrl(imgproxyUrl) {
  try {
    // Extract the base64-encoded part from imgproxy URL
    // Format: https://ukathletics.com/imgproxy/{hash}/fit/{width}/{height}/ce/0/{base64url}.png
    const match = imgproxyUrl.match(/\/ce\/0\/([^.]+)/);
    if (!match) return null;

    const base64Url = match[1];
    // Decode base64 to get original Google Cloud Storage URL
    const originalUrl = Buffer.from(base64Url, 'base64').toString('utf-8');

    return originalUrl;
  } catch (error) {
    console.error(`Failed to decode: ${imgproxyUrl}`, error);
    return null;
  }
}

async function main() {
  console.log('\n🔄 FIXING KENTUCKY HEADSHOTS');
  console.log('Converting imgproxy URLs to direct Google Cloud Storage URLs...\n');

  // Get Kentucky team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Kentucky')
    .single();

  if (!team) {
    console.log('❌ Kentucky team not found');
    return;
  }

  // Get all Kentucky athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} Kentucky athletes\n`);

  let updated = 0;
  let skipped = 0;

  for (const athlete of athletes) {
    if (!athlete.photo_url) {
      console.log(`  ⚠️  ${athlete.name}: No photo URL`);
      skipped++;
      continue;
    }

    // Check if it's an imgproxy URL
    if (athlete.photo_url.includes('/imgproxy/')) {
      const directUrl = decodeImgproxyUrl(athlete.photo_url);

      if (directUrl) {
        await supabase
          .from('athletes')
          .update({ photo_url: directUrl })
          .eq('id', athlete.id);

        console.log(`  ✅ ${athlete.name}`);
        console.log(`     From: ${athlete.photo_url.substring(0, 60)}...`);
        console.log(`     To:   ${directUrl}`);
        updated++;
      } else {
        console.log(`  ❌ ${athlete.name}: Failed to decode imgproxy URL`);
        skipped++;
      }
    } else {
      console.log(`  ⏭️  ${athlete.name}: Not an imgproxy URL`);
      skipped++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ KENTUCKY FIX COMPLETE');
  console.log('='.repeat(70));
  console.log(`Updated: ${updated} athletes`);
  console.log(`Skipped: ${skipped} athletes`);
}

main();
