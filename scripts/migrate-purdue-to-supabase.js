require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Download image from URL
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Generate a simple filename from athlete name
 */
function generateFilename(athleteName, originalUrl) {
  // Get file extension from original URL
  const ext = originalUrl.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';

  // Create clean filename from name
  const cleanName = athleteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `purdue/${cleanName}.${ext}`;
}

async function main() {
  console.log('🔄 Migrating Purdue headshots to Supabase Storage\n');

  // Get Purdue team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Purdue')
    .single();

  if (!team) {
    console.error('❌ Purdue team not found');
    return;
  }

  // Get all Purdue athletes with Google Storage URLs
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%storage.googleapis.com%');

  console.log(`Found ${athletes.length} athletes with Google Storage URLs\n`);

  let success = 0;
  let failed = 0;

  for (const athlete of athletes) {
    try {
      console.log(`Processing ${athlete.name}...`);

      // Download image
      console.log(`  Downloading from: ${athlete.photo_url.substring(0, 60)}...`);
      const imageBuffer = await downloadImage(athlete.photo_url);
      console.log(`  Downloaded: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

      // Generate filename
      const filename = generateFilename(athlete.name, athlete.photo_url);
      console.log(`  Uploading to: ${filename}`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('athlete-photos')
        .upload(filename, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true, // Overwrite if exists
        });

      if (uploadError) {
        console.log(`  ❌ Upload failed: ${uploadError.message}`);
        failed++;
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('athlete-photos')
        .getPublicUrl(filename);

      console.log(`  Public URL: ${publicUrl}`);

      // Update athlete record
      const { error: updateError } = await supabase
        .from('athletes')
        .update({ photo_url: publicUrl })
        .eq('id', athlete.id);

      if (updateError) {
        console.log(`  ❌ Database update failed: ${updateError.message}`);
        failed++;
        continue;
      }

      console.log(`  ✅ Success!\n`);
      success++;

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('='.repeat(70));
  console.log(`✅ Success: ${success}/${athletes.length}`);
  console.log(`❌ Failed: ${failed}/${athletes.length}`);
  console.log('='.repeat(70));
  console.log('\n💡 Next steps:');
  console.log('   1. Verify images are loading correctly');
  console.log('   2. Deploy to production');
}

main().catch(console.error);
