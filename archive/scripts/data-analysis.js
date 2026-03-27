require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const BAD_PHOTO_PATTERNS = [
  { label: 'ESPN logo', pattern: 'espncdn.com' },
  { label: 'Ad tracker (wmt.digital)', pattern: 'ads.wmt.digital' },
  { label: 'Ad tracker (ad_counter)', pattern: 'ad_counter' },
  { label: 'Ad tracker (nameengine)', pattern: 'nameengine.com' },
  { label: 'S3 dummy', pattern: 'ss-dummy-data.s3' },
  { label: 'Sutter Health logo', pattern: 'Sutter_Health' },
  { label: 'Local logo (/logos/)', pattern: '/logos/' },
  { label: 'Relative path', pattern: (url) => url && !url.startsWith('http') },
  { label: 'Ad tracker (satisfilabs)', pattern: 'satisfilabs' },
];

function classifyPhoto(url) {
  if (!url) return 'NULL';
  for (const p of BAD_PHOTO_PATTERNS) {
    if (typeof p.pattern === 'function') { if (p.pattern(url)) return p.label; }
    else if (url.includes(p.pattern)) return p.label;
  }
  // Check if it's a team logo (likely from teams table logo_url patterns)
  if (url.includes('supabase.co/storage') && !url.includes('athletes')) return 'Team logo (Supabase)';
  if (url.includes('d3mojdi32uv7q.cloudfront.net')) return 'Team logo (cloudfront logo CDN)';
  // Good patterns
  if (url.includes('sidearmdev.com')) return 'Sidearm proxy (may vary)';
  if (url.includes('cloudfront.net')) return 'Cloudfront direct';
  if (url.includes('supabase.co')) return 'Supabase storage';
  if (url.includes('googleapis.com')) return 'Google Cloud Storage';
  if (url.includes('calbears.com/images/')) return 'calbears.com direct';
  if (url.includes('towsontigers.com/images/')) return 'towsontigers.com direct';
  if (url.includes('unlvrebels.com/images/')) return 'unlvrebels.com direct';
  if (url.includes('navysports.com/images/')) return 'navysports.com direct';
  if (url.includes('images/')) return 'Team CDN direct';
  return 'Other/Unknown';
}

async function main() {
  console.log('='.repeat(70));
  console.log('NCAA SWIM & DIVE TRACKER — FULL DATA ANALYSIS');
  console.log('='.repeat(70));

  // 1. Overall counts
  const { data: teams } = await supabase.from('teams').select('id, name, logo_url, conference').order('name');

  // Fetch all athletes in pages (Supabase default limit is 1000)
  let allAthletes = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase.from('athletes').select('id, name, photo_url, profile_url, team_id').range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    allAthletes = allAthletes.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`\n📊 OVERVIEW`);
  console.log(`  Teams: ${teams.length}`);
  console.log(`  Total athletes: ${allAthletes.length}`);
  console.log(`  Avg athletes/team: ${(allAthletes.length / teams.length).toFixed(1)}`);

  // 2. Photo coverage
  const noPhoto = allAthletes.filter(a => !a.photo_url);
  const hasPhoto = allAthletes.filter(a => a.photo_url);
  const noProfile = allAthletes.filter(a => !a.profile_url);
  const hasProfile = allAthletes.filter(a => a.profile_url);

  console.log(`\n📸 PHOTO COVERAGE`);
  console.log(`  Has photo_url:     ${hasPhoto.length} (${(hasPhoto.length/allAthletes.length*100).toFixed(1)}%)`);
  console.log(`  Missing photo_url: ${noPhoto.length} (${(noPhoto.length/allAthletes.length*100).toFixed(1)}%)`);
  console.log(`  Has profile_url:   ${hasProfile.length} (${(hasProfile.length/allAthletes.length*100).toFixed(1)}%)`);
  console.log(`  Missing profile:   ${noProfile.length} (${(noProfile.length/allAthletes.length*100).toFixed(1)}%)`);

  // 3. Photo classification
  const photoTypes = {};
  for (const a of allAthletes) {
    const type = classifyPhoto(a.photo_url);
    photoTypes[type] = (photoTypes[type] || 0) + 1;
  }

  console.log(`\n🖼️  PHOTO SOURCE BREAKDOWN`);
  Object.entries(photoTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    const pct = (count / allAthletes.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / allAthletes.length * 30));
    console.log(`  ${type.padEnd(35)} ${String(count).padStart(4)} (${pct}%) ${bar}`);
  });

  // 4. Identify bad photos
  const badPhotos = allAthletes.filter(a => {
    if (!a.photo_url) return false;
    return BAD_PHOTO_PATTERNS.some(p =>
      typeof p.pattern === 'function' ? p.pattern(a.photo_url) : a.photo_url.includes(p.pattern)
    );
  });

  // Also flag team logos (photo_url matches team's logo_url)
  const teamLogoUrls = new Set(teams.map(t => t.logo_url).filter(Boolean));
  const usingTeamLogo = allAthletes.filter(a => a.photo_url && teamLogoUrls.has(a.photo_url));
  const sidearmConvert = allAthletes.filter(a => a.photo_url?.includes('sidearmdev.com/convert'));

  console.log(`\n⚠️  PROBLEM PHOTOS`);
  console.log(`  Using team logo:          ${usingTeamLogo.length}`);
  console.log(`  Sidearm /convert/ URLs:   ${sidearmConvert.length} (low quality fallback)`);
  console.log(`  Known bad patterns:       ${badPhotos.length}`);
  console.log(`  NULL photo_url:           ${noPhoto.length}`);
  const totalProblematic = new Set([...usingTeamLogo, ...sidearmConvert, ...badPhotos, ...noPhoto].map(a => a.id));
  console.log(`  Total problematic:        ${totalProblematic.size} of ${allAthletes.length} (${(totalProblematic.size/allAthletes.length*100).toFixed(1)}%)`);

  // 5. Per-team breakdown
  console.log(`\n📋 PER-TEAM BREAKDOWN`);
  console.log(`  ${'Team'.padEnd(25)} ${'Athletes'.padStart(8)} ${'w/Photo'.padStart(8)} ${'w/Profile'.padStart(10)} ${'Logo/Bad'.padStart(9)} ${'Issues'}`);
  console.log('  ' + '-'.repeat(80));

  const teamIssues = [];

  for (const team of teams) {
    const athletes = allAthletes.filter(a => a.team_id === team.id);
    const withPhoto = athletes.filter(a => a.photo_url);
    const withProfile = athletes.filter(a => a.profile_url);
    const withTeamLogo = athletes.filter(a => a.photo_url && teamLogoUrls.has(a.photo_url));
    const withBad = athletes.filter(a => {
      if (!a.photo_url) return false;
      return BAD_PHOTO_PATTERNS.some(p =>
        typeof p.pattern === 'function' ? p.pattern(a.photo_url) : a.photo_url.includes(p.pattern)
      );
    });
    const withConvert = athletes.filter(a => a.photo_url?.includes('sidearmdev.com/convert'));

    const issues = [];
    if (athletes.filter(a => !a.photo_url).length > 0) issues.push(`${athletes.filter(a => !a.photo_url).length} null photos`);
    if (withTeamLogo.length > 0) issues.push(`${withTeamLogo.length} logos`);
    if (withBad.length > 0) issues.push(`${withBad.length} bad URLs`);
    if (withConvert.length > 0) issues.push(`${withConvert.length} convert URLs`);
    if (withProfile.length === 0 && athletes.length > 0) issues.push('NO profile URLs');
    else if (withProfile.length < athletes.length) issues.push(`${athletes.length - withProfile.length} missing profiles`);

    const issueStr = issues.join(', ');
    const hasIssues = issues.length > 0;

    console.log(`  ${team.name.padEnd(25)} ${String(athletes.length).padStart(8)} ${String(withPhoto.length).padStart(8)} ${String(withProfile.length).padStart(10)} ${String(withTeamLogo.length + withBad.length).padStart(9)}  ${issueStr}`);

    teamIssues.push({
      team: team.name,
      athletes: athletes.length,
      withPhoto: withPhoto.length,
      withProfile: withProfile.length,
      teamLogo: withTeamLogo.length,
      badPhoto: withBad.length,
      convertUrls: withConvert.length,
      noPhoto: athletes.filter(a => !a.photo_url).length,
      issues,
    });
  }

  // 6. Summary stats
  const cleanTeams = teamIssues.filter(t => t.issues.length === 0);
  const issueTeams = teamIssues.filter(t => t.issues.length > 0);

  console.log(`\n✅ TEAM HEALTH`);
  console.log(`  Clean teams (no issues): ${cleanTeams.length}/${teams.length}`);
  console.log(`  Teams with issues:       ${issueTeams.length}/${teams.length}`);

  console.log(`\n🔝 TEAMS WITH MOST ISSUES:`);
  issueTeams
    .sort((a, b) => (b.teamLogo + b.badPhoto + b.noPhoto) - (a.teamLogo + a.badPhoto + a.noPhoto))
    .slice(0, 10)
    .forEach(t => console.log(`  ${t.team.padEnd(25)} ${t.issues.join(', ')}`));

  // 7. Athletes with season URL stored as profile_url (wrong)
  const badProfileUrls = allAthletes.filter(a =>
    a.profile_url && (
      a.profile_url.match(/\/\d{4}-\d{2}\s*$/) ||  // ends with year like /2024-25
      a.profile_url.endsWith('/roster/') ||
      a.profile_url.endsWith('/roster') && !a.profile_url.split('/roster')[1]?.includes('-')
    )
  );
  if (badProfileUrls.length > 0) {
    console.log(`\n🔗 BAD PROFILE URLs (season pages, not individual):`);
    badProfileUrls.forEach(a => {
      const team = teams.find(t => t.id === a.team_id);
      console.log(`  ${(team?.name || '?').padEnd(20)} ${a.name.padEnd(25)} ${a.profile_url}`);
    });
  }

  // 8. Duplicate athlete names within same team
  console.log(`\n👥 DUPLICATE ATHLETE NAMES (same team):`);
  let dupeCount = 0;
  for (const team of teams) {
    const athletes = allAthletes.filter(a => a.team_id === team.id);
    const nameCounts = {};
    athletes.forEach(a => { nameCounts[a.name] = (nameCounts[a.name] || 0) + 1; });
    const dupes = Object.entries(nameCounts).filter(([, c]) => c > 1);
    if (dupes.length > 0) {
      dupes.forEach(([name, count]) => {
        console.log(`  ${team.name.padEnd(20)} ${name} (${count}x)`);
        dupeCount++;
      });
    }
  }
  if (dupeCount === 0) console.log('  None found ✅');

  // 9. Teams by conference (if conference data exists)
  const conferences = {};
  teams.forEach(t => {
    const conf = t.conference || 'Unknown';
    if (!conferences[conf]) conferences[conf] = { teams: 0, athletes: 0 };
    conferences[conf].teams++;
    conferences[conf].athletes += allAthletes.filter(a => a.team_id === t.id).length;
  });
  if (Object.keys(conferences).length > 1 || !conferences['Unknown']) {
    console.log(`\n🏆 BY CONFERENCE`);
    Object.entries(conferences).sort((a, b) => b[1].athletes - a[1].athletes).forEach(([conf, data]) => {
      console.log(`  ${conf.padEnd(20)} ${data.teams} teams, ${data.athletes} athletes`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('END OF ANALYSIS');
  console.log('='.repeat(70));
}
main().catch(console.error);
