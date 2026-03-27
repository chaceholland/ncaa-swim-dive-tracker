// Test the image bypass logic with real URLs from database

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Replicate the bypass logic from AthleteCard.tsx
function shouldBypassVercelOptimization(photoUrl) {
  if (!photoUrl) return false;

  return photoUrl.includes('/render/image/') ||      // Supabase Storage (optimized)
         photoUrl.includes('supabase.co/storage') || // Supabase Storage (direct)
         photoUrl.includes('sidearmdev.com') ||      // SideArm CDN
         photoUrl.includes('cloudfront.net') ||      // CloudFront CDN
         photoUrl.includes('/imgproxy/') ||          // School-hosted imgproxy
         photoUrl.includes('storage.googleapis.com') || // Google Cloud Storage
         (photoUrl.startsWith('http') &&            // External URLs with size params
          (photoUrl.includes('?width=') ||
           photoUrl.includes('&width=') ||
           photoUrl.includes('?height=') ||
           photoUrl.includes('&height=')));
}

async function main() {
  // Get sample athletes from various URL patterns
  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url, teams!inner(name, conference)')
    .not('photo_url', 'is', null)
    .limit(1000);

  const patterns = {
    'Supabase Storage': [],
    'SideArm CDN': [],
    'CloudFront': [],
    'School imgproxy': [],
    'Google Cloud Storage': [],
    'Direct school URLs': [],
    'Relative/Local': [],
    'Other external': []
  };

  let bypassed = 0;
  let notBypassed = 0;

  athletes.forEach(a => {
    const url = a.photo_url;
    const willBypass = shouldBypassVercelOptimization(url);

    if (willBypass) bypassed++;
    else notBypassed++;

    // Categorize
    let category;
    if (url.includes('/render/image/')) {
      category = 'Supabase Storage';
    } else if (url.includes('sidearmdev.com')) {
      category = 'SideArm CDN';
    } else if (url.includes('cloudfront.net')) {
      category = 'CloudFront';
    } else if (url.includes('/imgproxy/')) {
      category = 'School imgproxy';
    } else if (url.includes('storage.googleapis.com')) {
      category = 'Google Cloud Storage';
    } else if (url.startsWith('http') && (url.includes('?width=') || url.includes('&width=') || url.includes('?height=') || url.includes('&height='))) {
      category = 'Direct school URLs';
    } else if (!url.startsWith('http')) {
      category = 'Relative/Local';
    } else {
      category = 'Other external';
    }

    if (patterns[category].length < 2) {
      patterns[category].push({
        name: a.name,
        team: a.teams.name,
        conference: a.teams.conference,
        url: url.substring(0, 100),
        bypassed: willBypass
      });
    }
  });

  console.log('\n=== IMAGE BYPASS LOGIC TEST ===\n');
  console.log(`Total athletes tested: ${athletes.length}`);
  console.log(`Will bypass Vercel: ${bypassed} (${((bypassed/athletes.length)*100).toFixed(1)}%)`);
  console.log(`Will use Vercel: ${notBypassed} (${((notBypassed/athletes.length)*100).toFixed(1)}%)`);

  console.log('\n=== PATTERN BREAKDOWN ===\n');

  Object.entries(patterns).forEach(([category, examples]) => {
    if (examples.length === 0) return;

    console.log(`\n${category} (${examples.length} shown):`);
    examples.forEach(ex => {
      const status = ex.bypassed ? '✅ BYPASSED' : '❌ VERCEL';
      console.log(`  ${status} - ${ex.conference} - ${ex.team} - ${ex.name}`);
      console.log(`    ${ex.url}`);
    });
  });

  console.log('\n=== EXPECTED RESULTS ===\n');
  console.log('✅ All externally-hosted images should be bypassed (use regular <img>)');
  console.log('❌ Only relative/local paths should use Vercel Image Optimization');
  console.log('');

  if (notBypassed > 50) {
    console.log('⚠️  WARNING: High number of images will still use Vercel!');
    console.log('   This may indicate the bypass logic needs further adjustment.');
  } else {
    console.log('✅ Bypass logic appears correct - most external images will bypass Vercel');
  }
}

main();
