require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Replicate the bypass logic from AthleteCard.tsx
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

function categorizeUrl(url) {
  if (!url) return 'No URL';
  if (!url.startsWith('http')) return 'Relative/Local';
  if (url.includes('/render/image/')) return 'Supabase (optimized)';
  if (url.includes('supabase.co/storage')) return 'Supabase (direct)';
  if (url.includes('sidearmdev.com')) return 'SideArm CDN';
  if (url.includes('cloudfront.net')) return 'CloudFront';
  if (url.includes('/imgproxy/')) return 'School imgproxy';
  if (url.includes('storage.googleapis.com')) return 'Google Cloud';
  if (url.includes('?width=') || url.includes('&width=')) return 'Direct w/params';
  return 'Other external';
}

async function checkConference(conferenceName) {
  // Get teams in this conference
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('conference', conferenceName)
    .order('name');

  if (!teams || teams.length === 0) {
    return null;
  }

  // Get sample athletes from all teams in conference
  const teamIds = teams.map(t => t.id);
  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url, teams!inner(name)')
    .in('team_id', teamIds)
    .not('photo_url', 'is', null)
    .limit(100);

  if (!athletes || athletes.length === 0) {
    return {
      name: conferenceName,
      teams: teams.length,
      athletes: 0,
      bypassed: 0,
      notBypassed: 0,
      patterns: {},
      issues: []
    };
  }

  let bypassed = 0;
  let notBypassed = 0;
  const patterns = {};
  const issues = [];

  athletes.forEach(a => {
    const willBypass = shouldBypassVercelOptimization(a.photo_url);
    const category = categorizeUrl(a.photo_url);

    patterns[category] = (patterns[category] || 0) + 1;

    if (willBypass) {
      bypassed++;
    } else {
      notBypassed++;
      // Only track non-relative URLs as issues
      if (a.photo_url.startsWith('http')) {
        issues.push({
          athlete: a.name,
          team: a.teams.name,
          url: a.photo_url.substring(0, 80),
          category
        });
      }
    }
  });

  return {
    name: conferenceName,
    teams: teams.length,
    athletes: athletes.length,
    bypassed,
    notBypassed,
    bypassRate: ((bypassed / athletes.length) * 100).toFixed(1),
    patterns,
    issues
  };
}

async function main() {
  // Get all unique conferences
  const { data: conferences } = await supabase
    .from('teams')
    .select('conference')
    .order('conference');

  const uniqueConferences = [...new Set(conferences.map(c => c.conference))];

  console.log('\n=== CHECKING ALL CONFERENCES FOR HEADSHOT ISSUES ===\n');
  console.log(`Found ${uniqueConferences.length} conferences\n`);

  const results = [];

  for (const conf of uniqueConferences) {
    const result = await checkConference(conf);
    if (result) {
      results.push(result);
    }
  }

  // Sort by bypass rate (lowest first to show problems)
  results.sort((a, b) => parseFloat(a.bypassRate) - parseFloat(b.bypassRate));

  console.log('\n=== CONFERENCE SUMMARY (sorted by bypass rate) ===\n');

  results.forEach(r => {
    const status = parseFloat(r.bypassRate) >= 95 ? '✅' :
                   parseFloat(r.bypassRate) >= 90 ? '⚠️' : '❌';

    console.log(`${status} ${r.name.toUpperCase().padEnd(15)} - ${r.bypassRate}% bypassed (${r.bypassed}/${r.athletes} athletes, ${r.teams} teams)`);

    // Show pattern breakdown
    const sortedPatterns = Object.entries(r.patterns).sort((a, b) => b[1] - a[1]);
    sortedPatterns.forEach(([pattern, count]) => {
      console.log(`     ${count.toString().padStart(3)} - ${pattern}`);
    });

    // Show issues if any
    if (r.issues.length > 0) {
      console.log(`     ⚠️  ${r.issues.length} external URLs NOT bypassed:`);
      r.issues.slice(0, 3).forEach(issue => {
        console.log(`        - ${issue.team}: ${issue.athlete}`);
        console.log(`          ${issue.url}...`);
      });
      if (r.issues.length > 3) {
        console.log(`        ... and ${r.issues.length - 3} more`);
      }
    }
    console.log('');
  });

  // Summary
  const problemConferences = results.filter(r => parseFloat(r.bypassRate) < 95);
  const totalAthletes = results.reduce((sum, r) => sum + r.athletes, 0);
  const totalBypassed = results.reduce((sum, r) => sum + r.bypassed, 0);
  const overallRate = ((totalBypassed / totalAthletes) * 100).toFixed(1);

  console.log('\n=== OVERALL SUMMARY ===\n');
  console.log(`Total athletes checked: ${totalAthletes}`);
  console.log(`Overall bypass rate: ${overallRate}%`);
  console.log(`Conferences with issues (<95% bypass): ${problemConferences.length}/${results.length}`);

  if (problemConferences.length > 0) {
    console.log('\n⚠️  CONFERENCES NEEDING ATTENTION:');
    problemConferences.forEach(r => {
      console.log(`   - ${r.name}: ${r.bypassRate}% (${r.issues.length} external URLs not bypassed)`);
    });
  } else {
    console.log('\n✅ All conferences have >95% bypass rate - no issues detected!');
  }
}

main();
