require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Common coach keywords to flag
const COACH_KEYWORDS = [
  'coach', 'assistant', 'head coach', 'diving coach',
  'volunteer', 'director', 'coordinator', 'trainer'
];

async function auditTeam(team) {
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  const issues = {
    missingHeadshots: [],
    lowQuality: [],
    brokenUrls: [],
    possibleCoaches: [],
    total: athletes.length
  };

  for (const athlete of athletes) {
    const name = athlete.name.toLowerCase();

    // Check for possible coaches
    if (COACH_KEYWORDS.some(keyword => name.includes(keyword))) {
      issues.possibleCoaches.push(athlete.name);
      continue;
    }

    // Check for missing headshots (using logo)
    if (!athlete.photo_url || athlete.photo_url.includes('/logos/')) {
      issues.missingHeadshots.push(athlete.name);
      continue;
    }

    // Check for low quality images
    if (athlete.photo_url.includes('width=')) {
      const widthMatch = athlete.photo_url.match(/width=(\d+)/);
      if (widthMatch && parseInt(widthMatch[1]) < 800) {
        issues.lowQuality.push({
          name: athlete.name,
          size: parseInt(widthMatch[1])
        });
      }
    }

    // Check for Supabase-hosted images (often low quality uploads)
    if (athlete.photo_url.includes('supabase.co/storage')) {
      issues.lowQuality.push({
        name: athlete.name,
        size: 'supabase-upload'
      });
    }

    // Check for data URIs or invalid URLs
    if (athlete.photo_url.startsWith('data:') ||
        athlete.photo_url === 'null' ||
        athlete.photo_url === 'undefined') {
      issues.brokenUrls.push(athlete.name);
    }
  }

  return issues;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('NCAA SWIM TRACKER - COMPREHENSIVE DATA QUALITY AUDIT');
  console.log('='.repeat(80) + '\n');

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .order('name');

  console.log(`Auditing ${teams.length} teams...\n`);

  const allIssues = {
    missingHeadshots: 0,
    lowQuality: 0,
    brokenUrls: 0,
    possibleCoaches: 0,
    totalAthletes: 0
  };

  const teamReports = [];

  for (const team of teams) {
    const issues = await auditTeam(team);
    allIssues.totalAthletes += issues.total;

    const hasIssues =
      issues.missingHeadshots.length > 0 ||
      issues.lowQuality.length > 0 ||
      issues.brokenUrls.length > 0 ||
      issues.possibleCoaches.length > 0;

    if (hasIssues) {
      teamReports.push({ team: team.name, issues });
      allIssues.missingHeadshots += issues.missingHeadshots.length;
      allIssues.lowQuality += issues.lowQuality.length;
      allIssues.brokenUrls += issues.brokenUrls.length;
      allIssues.possibleCoaches += issues.possibleCoaches.length;
    }
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total athletes: ${allIssues.totalAthletes}`);
  console.log(`Total teams: ${teams.length}`);
  console.log(`Teams with issues: ${teamReports.length}\n`);
  console.log(`Missing headshots: ${allIssues.missingHeadshots}`);
  console.log(`Low quality images: ${allIssues.lowQuality}`);
  console.log(`Broken URLs: ${allIssues.brokenUrls}`);
  console.log(`Possible coaches: ${allIssues.possibleCoaches}`);

  // Print detailed team reports
  if (teamReports.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED ISSUES BY TEAM');
    console.log('='.repeat(80));

    for (const report of teamReports) {
      const { team, issues } = report;
      const totalIssues =
        issues.missingHeadshots.length +
        issues.lowQuality.length +
        issues.brokenUrls.length +
        issues.possibleCoaches.length;

      console.log(`\n${team} (${totalIssues} issues):`);

      if (issues.possibleCoaches.length > 0) {
        console.log(`  ⚠️  POSSIBLE COACHES (${issues.possibleCoaches.length}):`);
        issues.possibleCoaches.forEach(name => console.log(`      - ${name}`));
      }

      if (issues.missingHeadshots.length > 0) {
        console.log(`  📷 MISSING HEADSHOTS (${issues.missingHeadshots.length}):`);
        issues.missingHeadshots.slice(0, 5).forEach(name => console.log(`      - ${name}`));
        if (issues.missingHeadshots.length > 5) {
          console.log(`      ... and ${issues.missingHeadshots.length - 5} more`);
        }
      }

      if (issues.lowQuality.length > 0) {
        console.log(`  🔍 LOW QUALITY (${issues.lowQuality.length}):`);
        issues.lowQuality.slice(0, 5).forEach(item => {
          const sizeInfo = typeof item.size === 'number' ? `${item.size}x${item.size}` : item.size;
          console.log(`      - ${item.name} (${sizeInfo})`);
        });
        if (issues.lowQuality.length > 5) {
          console.log(`      ... and ${issues.lowQuality.length - 5} more`);
        }
      }

      if (issues.brokenUrls.length > 0) {
        console.log(`  ❌ BROKEN URLs (${issues.brokenUrls.length}):`);
        issues.brokenUrls.forEach(name => console.log(`      - ${name}`));
      }
    }
  } else {
    console.log('\n✅ No issues found! All teams have high-quality data.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(80) + '\n');
}

main();
