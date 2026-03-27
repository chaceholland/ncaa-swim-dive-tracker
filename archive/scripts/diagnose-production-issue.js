require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const problematicTeams = [
  'Cal',
  'SMU',
  'Stanford',
  'Virginia',
  'Notre Dame',
  'Virginia Tech',
  'Georgia Tech'
];

async function diagnoseTeam(teamName) {
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`\n❌ ${teamName}: NOT FOUND IN DATABASE`);
    return;
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url')
    .eq('team_id', team.id)
    .not('photo_url', 'is', null)
    .limit(5);

  console.log(`\n=== ${teamName} ===`);
  console.log(`Athletes with photos: ${athletes?.length || 0}`);

  if (!athletes || athletes.length === 0) {
    console.log('❌ No athletes with photos found!');
    return;
  }

  athletes.forEach(a => {
    const url = a.photo_url;

    // Check what bypass pattern should match
    let shouldBypass = false;
    let reason = '';

    if (url.includes('/render/image/')) {
      shouldBypass = true;
      reason = 'Supabase (optimized)';
    } else if (url.includes('supabase.co/storage')) {
      shouldBypass = true;
      reason = 'Supabase (direct)';
    } else if (url.includes('sidearmdev.com')) {
      shouldBypass = true;
      reason = 'SideArm CDN';
    } else if (url.includes('cloudfront.net')) {
      shouldBypass = true;
      reason = 'CloudFront';
    } else if (url.includes('/imgproxy/')) {
      shouldBypass = true;
      reason = 'School imgproxy';
    } else if (url.includes('storage.googleapis.com')) {
      shouldBypass = true;
      reason = 'Google Cloud Storage';
    } else if (url.startsWith('http') &&
               (url.includes('?width=') || url.includes('&width=') ||
                url.includes('?height=') || url.includes('&height='))) {
      shouldBypass = true;
      reason = 'Direct w/size params';
    } else if (url.startsWith('http')) {
      shouldBypass = false;
      reason = 'EXTERNAL - NO BYPASS MATCH!';
    } else {
      shouldBypass = false;
      reason = 'Relative/Local (should use Vercel)';
    }

    const status = shouldBypass ? '✅' : '❌';
    console.log(`  ${status} ${a.name}`);
    console.log(`     Reason: ${reason}`);
    console.log(`     URL: ${url.substring(0, 80)}...`);
  });
}

async function main() {
  console.log('\n=== DIAGNOSING PROBLEMATIC TEAMS ===');
  console.log('Teams reported as not working:');
  console.log(problematicTeams.join(', '));

  for (const team of problematicTeams) {
    await diagnoseTeam(team);
  }

  console.log('\n\n=== POSSIBLE CAUSES ===');
  console.log('1. Deployment issue: Code fix not deployed to production yet');
  console.log('2. Browser cache: Old JavaScript still cached in browser');
  console.log('3. Vercel cache: Vercel serving cached version of pages');
  console.log('4. CDN cache: Images cached from before the fix');
  console.log('\n=== RECOMMENDED ACTIONS ===');
  console.log('1. Check Vercel dashboard for latest deployment');
  console.log('2. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)');
  console.log('3. Check browser console for actual errors');
  console.log('4. Verify production source includes bypass logic');
}

main();
