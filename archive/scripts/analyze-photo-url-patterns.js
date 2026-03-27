require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: athletes } = await supabase
    .from('athletes')
    .select('photo_url')
    .not('photo_url', 'is', null)
    .limit(2000);

  const patterns = {};
  const examples = {};

  athletes.forEach(a => {
    if (!a.photo_url) return;

    let category = 'other';

    if (a.photo_url.includes('/render/image/')) {
      category = 'Supabase (/render/image/)';
    } else if (a.photo_url.includes('sidearmdev.com')) {
      category = 'SideArm CDN';
    } else if (a.photo_url.includes('cloudfront.net')) {
      category = 'CloudFront';
    } else if (a.photo_url.includes('/imgproxy/')) {
      category = 'School imgproxy';
    } else if (a.photo_url.includes('storage.googleapis.com')) {
      category = 'Google Cloud Storage';
    } else if (a.photo_url.includes('supabase.co')) {
      category = 'Supabase direct';
    } else if (a.photo_url.startsWith('http')) {
      category = 'Direct school URL';
    } else {
      category = 'Relative/Local';
    }

    patterns[category] = (patterns[category] || 0) + 1;

    if (!examples[category]) {
      examples[category] = a.photo_url.substring(0, 100);
    }
  });

  console.log('\n=== PHOTO URL PATTERNS ===\n');
  Object.entries(patterns).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => {
    console.log(`${v.toString().padStart(5)} - ${k}`);
    console.log(`         Example: ${examples[k]}`);
  });

  console.log(`\nTotal athletes checked: ${athletes.length}`);
}

main();
