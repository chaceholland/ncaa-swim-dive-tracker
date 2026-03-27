require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n📦 CHECKING: Supabase Storage Buckets\n');

  // List all buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.log('❌ Error listing buckets:', bucketsError.message);
    return;
  }

  console.log(`Found ${buckets.length} storage buckets:`);
  buckets.forEach(bucket => {
    console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
  });

  // List files in each bucket
  for (const bucket of buckets) {
    console.log(`\n📂 Bucket: ${bucket.name}`);
    
    const { data: files, error: filesError } = await supabase.storage
      .from(bucket.name)
      .list('', { limit: 100 });
    
    if (filesError) {
      console.log(`  ❌ Error: ${filesError.message}`);
      continue;
    }

    if (files.length === 0) {
      console.log(`  (empty)`);
      continue;
    }

    console.log(`  ${files.length} files found:`);
    files.forEach(file => {
      if (file.name) {
        console.log(`    - ${file.name}`);
      }
    });

    // Also check for subdirectories
    const folders = files.filter(f => f.id === null);
    for (const folder of folders) {
      const { data: subfiles } = await supabase.storage
        .from(bucket.name)
        .list(folder.name, { limit: 20 });
      
      if (subfiles && subfiles.length > 0) {
        console.log(`\n  📁 ${folder.name}/ (${subfiles.length} files):`);
        subfiles.slice(0, 10).forEach(file => {
          console.log(`    - ${file.name}`);
        });
        if (subfiles.length > 10) {
          console.log(`    ... and ${subfiles.length - 10} more`);
        }
      }
    }
  }
}

main();
