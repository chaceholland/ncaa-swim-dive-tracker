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

async function checkConference(conferenceName) {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('conference', conferenceName)
    .order('name');

  if (!teams || teams.length === 0) return null;

  const teamIds = teams.map(t => t.id);
  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url, teams!inner(name)')
    .in('team_id', teamIds)
    .not('photo_url', 'is', null)
    .limit(200);

  if (!athletes || athletes.length === 0) return null;

  const externalUrls = athletes.filter(a => a.photo_url && a.photo_url.startsWith('http'));
  const localUrls = athletes.filter(a => a.photo_url && !a.photo_url.startsWith('http'));

  let externalBypassed = 0;
  let externalNotBypassed = 0;
  const issues = [];

  externalUrls.forEach(a => {
    if (shouldBypassVercelOptimization(a.photo_url)) {
      externalBypassed++;
    } else {
      externalNotBypassed++;
      issues.push({
        team: a.teams.name,
        athlete: a.name,
        url: a.photo_url
      });
    }
  });

  return {
    name: conferenceName,
    teams: teams.length,
    totalAthletes: athletes.length,
    externalUrls: externalUrls.length,
    localUrls: localUrls.length,
    externalBypassed,
    externalNotBypassed,
    externalBypassRate: externalUrls.length > 0 ? ((externalBypassed / externalUrls.length) * 100).toFixed(1) : 'N/A',
    issues
  };
}

async function main() {
  const { data: conferences } = await supabase
    .from('teams')
    .select('conference')
    .order('conference');

  const uniqueConferences = [...new Set(conferences.map(c => c.conference))];

  console.log('\n=== EXTERNAL URL BYPASS CHECK (ONLY EXTERNAL URLS) ===\n');

  const results = [];
  for (const conf of uniqueConferences) {
    const result = await checkConference(conf);
    if (result && result.externalUrls > 0) {
      results.push(result);
    }
  }

  results.sort((a, b) => {
    const rateA = a.externalBypassRate === 'N/A' ? 100 : parseFloat(a.externalBypassRate);
    const rateB = b.externalBypassRate === 'N/A' ? 100 : parseFloat(b.externalBypassRate);
    return rateA - rateB;
  });

  results.forEach(r => {
    const rate = parseFloat(r.externalBypassRate);
    const status = rate === 100 ? '✅' : rate >= 95 ? '⚠️' : '❌';

    console.log(`\n${status} ${r.name.toUpperCase()}`);
    console.log(`   External URLs: ${r.externalUrls} (${r.externalBypassed} bypassed, ${r.externalNotBypassed} NOT bypassed)`);
    console.log(`   Bypass rate: ${r.externalBypassRate}%`);
    console.log(`   Local/relative URLs: ${r.localUrls} (correctly use Vercel)`);

    if (r.issues.length > 0) {
      console.log(`\n   ❌ PROBLEMS - ${r.issues.length} external URLs NOT bypassed:`);
      r.issues.forEach((issue, idx) => {
        if (idx < 5) {
          console.log(`      ${idx + 1}. ${issue.team} - ${issue.athlete}`);
          console.log(`         ${issue.url.substring(0, 90)}...`);
        }
      });
      if (r.issues.length > 5) {
        console.log(`      ... and ${r.issues.length - 5} more`);
      }
    }
  });

  const problemConferences = results.filter(r => parseFloat(r.externalBypassRate) < 100);
  const totalExternal = results.reduce((sum, r) => sum + r.externalUrls, 0);
  const totalExternalBypassed = results.reduce((sum, r) => sum + r.externalBypassed, 0);
  const totalIssues = results.reduce((sum, r) => sum + r.externalNotBypassed, 0);

  console.log('\n\n=== SUMMARY ===');
  console.log(`Total external URLs: ${totalExternal}`);
  console.log(`Total bypassed: ${totalExternalBypassed}`);
  console.log(`Total NOT bypassed: ${totalIssues}`);
  console.log(`Overall external bypass rate: ${((totalExternalBypassed / totalExternal) * 100).toFixed(1)}%`);

  if (totalIssues > 0) {
    console.log(`\n❌ ${totalIssues} external URLs still have issues across ${problemConferences.length} conferences`);
  } else {
    console.log('\n✅ All external URLs are correctly bypassed!');
  }
}

main();
