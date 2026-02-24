require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔄 Converting to Supabase Image Transformation URLs\n');

  // Get all athletes with Supabase Storage URLs
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .like('photo_url', '%supabase.co/storage/v1/object/public/athlete-photos%');

  console.log(`Found ${athletes.length} athletes with Supabase Storage URLs\n`);

  let updated = 0;

  for (const athlete of athletes) {
    // Convert from:
    // https://dtnozcqkuzhjmjvsfjqk.supabase.co/storage/v1/object/public/athlete-photos/purdue/name.jpg
    // To:
    // https://dtnozcqkuzhjmjvsfjqk.supabase.co/storage/v1/render/image/public/athlete-photos/purdue/name.jpg?width=400&height=500

    const newUrl = athlete.photo_url
      .replace('/object/public/', '/render/image/public/')
      + '?width=400&height=500';

    console.log(`${athlete.name}:`);
    console.log(`  Old: ${athlete.photo_url.substring(0, 80)}...`);
    console.log(`  New: ${newUrl.substring(0, 80)}...`);

    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: newUrl })
      .eq('id', athlete.id);

    if (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    } else {
      console.log(`  ✅ Updated\n`);
      updated++;
    }
  }

  console.log('='.repeat(70));
  console.log(`✅ Updated: ${updated}/${athletes.length}`);
  console.log('='.repeat(70));
  console.log('\n💡 Supabase will now handle image transformation');
  console.log('   No Vercel image optimization quota used!');
}

main().catch(console.error);
