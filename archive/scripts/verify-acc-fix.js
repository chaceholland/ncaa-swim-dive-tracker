require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Replicate the bypass logic
function shouldBypassVercelOptimization(photoUrl) {
  if (!photoUrl) return false;

  return photoUrl.includes('/render/image/') ||
         photoUrl.includes('supabase.co/storage') ||
         photoUrl.includes('sidearmdev.com') ||
         photoUrl.includes('cloudfront.net') ||
         photoUrl.includes('/imgproxy/') ||
         photoUrl.includes('storage.googleapis.com') ||
         (photoUrl.startsWith('http') &&
          (photoUrl.includes('?width=') ||
           photoUrl.includes('&width=') ||
           photoUrl.includes('?height=') ||
           photoUrl.includes('&height=')));
}

async function checkTeam(teamName) {
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, conference')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`${teamName}: NOT FOUND`);
    return;
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('team_id', team.id)
    .not('photo_url', 'is', null)
    .limit(5);

  if (!athletes || athletes.length === 0) {
    console.log(`${teamName}: No photos`);
    return;
  }

  let bypassed = 0;
  let notBypassed = 0;

  athletes.forEach(a => {
    if (shouldBypassVercelOptimization(a.photo_url)) {
      bypassed++;
    } else {
      notBypassed++;
    }
  });

  const status = notBypassed === 0 ? '✅ ALL FIXED' : `⚠️  ${notBypassed}/${athletes.length} still use Vercel`;
  console.log(`\n${teamName} (${team.conference}): ${status}`);

  athletes.forEach(a => {
    const willBypass = shouldBypassVercelOptimization(a.photo_url);
    const badge = willBypass ? '✅' : '❌';
    console.log(`  ${badge} ${a.name}`);
    console.log(`     ${a.photo_url.substring(0, 80)}...`);
  });
}

async function main() {
  console.log('\n=== VERIFYING ACC TEAM HEADSHOT FIX ===\n');

  const accTeams = [
    'Cal',
    'SMU',
    'Stanford',
    'Virginia',
    'Virginia Tech',
    'Duke',
    'North Carolina',
    'NC State',
    'Louisville',
    'Florida State',
    'Notre Dame',
    'Pittsburgh'
  ];

  for (const team of accTeams) {
    await checkTeam(team);
  }

  console.log('\n=== TESTING OTHER AFFECTED CONFERENCES ===\n');

  // Test a few from other conferences mentioned
  await checkTeam('Navy');
  await checkTeam('Cornell');
  await checkTeam('Harvard');
  await checkTeam('Purdue');

  console.log('\n✅ Verification complete!');
  console.log('All externally-hosted images should now bypass Vercel Image Optimization.');
}

main();
