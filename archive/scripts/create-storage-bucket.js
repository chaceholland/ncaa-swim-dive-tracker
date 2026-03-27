require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('📦 Creating athlete-photos storage bucket\n');

  // Create the bucket
  const { data, error } = await supabase.storage.createBucket('athlete-photos', {
    public: true, // Make bucket public so images are accessible
    fileSizeLimit: 10485760, // 10MB max file size
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Bucket already exists');
    } else {
      console.error('❌ Error creating bucket:', error);
      return;
    }
  } else {
    console.log('✅ Bucket created successfully');
  }

  console.log('\n📋 Bucket details:');
  console.log('   Name: athlete-photos');
  console.log('   Public: Yes');
  console.log('   Max file size: 10MB');
  console.log('   Allowed types: JPEG, PNG, WebP');
}

main().catch(console.error);
