import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function upgradeImageQuality() {
  console.log('🔍 Fetching athletes with photo URLs...\n');

  // Fetch all athletes with photo URLs
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .not('photo_url', 'is', null);

  if (error) {
    console.error('Error fetching athletes:', error);
    return;
  }

  console.log(`📊 Found ${athletes.length} athletes with photos\n`);

  let updated = 0;
  let skipped = 0;

  for (const athlete of athletes) {
    const oldUrl = athlete.photo_url;

    // Check if URL has width/height parameters
    if (oldUrl.includes('width=') && oldUrl.includes('height=')) {
      // Replace width=100&height=100 with width=800&height=800 for high res
      const newUrl = oldUrl
        .replace(/width=\d+/, 'width=800')
        .replace(/height=\d+/, 'height=800');

      // Update the athlete record
      const { error: updateError } = await supabase
        .from('athletes')
        .update({ photo_url: newUrl })
        .eq('id', athlete.id);

      if (updateError) {
        console.error(`❌ Error updating ${athlete.name}:`, updateError);
      } else {
        updated++;
        if (updated <= 5) {
          console.log(`✅ Updated ${athlete.name}`);
          console.log(`   Old: ${oldUrl.substring(0, 100)}...`);
          console.log(`   New: ${newUrl.substring(0, 100)}...`);
        }
      }
    } else {
      skipped++;
    }
  }

  console.log('\n============================================================');
  console.log('📈 UPGRADE COMPLETE');
  console.log('============================================================');
  console.log(`✅ Updated: ${updated} athletes`);
  console.log(`⏭️  Skipped: ${skipped} athletes`);
  console.log('============================================================\n');
}

upgradeImageQuality();
