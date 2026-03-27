require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function decodeImgproxyUrl(imgproxyUrl) {
  // Extract the base64-encoded portion from imgproxy URL
  // gopsusports.com uses pattern: .../q:90/{base64}.jpg
  const match = imgproxyUrl.match(/\/([^\/]+)\.(jpg|png)$/);

  if (!match) {
    console.log('    ⚠️  Could not extract base64 from URL');
    return null;
  }

  try {
    const base64Url = match[1];
    const originalUrl = Buffer.from(base64Url, 'base64').toString('utf-8');

    // Verify it's a valid storage.googleapis.com URL
    if (originalUrl.includes('storage.googleapis.com')) {
      return originalUrl;
    } else {
      console.log(`    ⚠️  Decoded URL is not from Google Cloud Storage: ${originalUrl}`);
      return null;
    }
  } catch (error) {
    console.log(`    ⚠️  Failed to decode: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔧 FIXING PENN STATE HEADSHOTS - DECODING IMGPROXY URLS');
  console.log('Converting imgproxy URLs to direct Google Cloud Storage URLs...\\n');

  // Get Penn State team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Penn State')
    .single();

  if (!team) {
    console.log('❌ Penn State team not found');
    return;
  }

  // Get Penn State athletes with imgproxy URLs
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%imgproxy%')
    .order('name');

  console.log(`Found ${athletes.length} Penn State athletes with imgproxy URLs\\n`);

  let updated = 0;
  let failed = 0;

  for (const athlete of athletes) {
    console.log(`  Processing: ${athlete.name}`);
    console.log(`    Current: ${athlete.photo_url.substring(0, 80)}...`);

    const decodedUrl = decodeImgproxyUrl(athlete.photo_url);

    if (decodedUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: decodedUrl })
        .eq('id', athlete.id);

      console.log(`    ✅ Decoded: ${decodedUrl}`);
      updated++;
    } else {
      console.log(`    ❌ Could not decode URL`);
      failed++;
    }

    console.log('');
  }

  console.log('='.repeat(70));
  console.log('✅ PENN STATE IMGPROXY DECODE COMPLETE');
  console.log('='.repeat(70));
  console.log(`Updated: ${updated}/${athletes.length} athletes`);
  if (failed > 0) {
    console.log(`Failed: ${failed} athletes`);
  }
  console.log('');
}

main();
