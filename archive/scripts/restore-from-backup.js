require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Team ID to full team data mapping
const TEAMS = {
  'alabama': { name: 'Alabama', conference: 'SEC', logo_url: 'https://rolltide.com/images/logos/Alabama_Athletics.png' },
  'arizona': { name: 'Arizona', conference: 'Pac-12', logo_url: 'https://dbukjj6eu5tsf.cloudfront.net/arizonawildcats.com/images/2023/10/13/UA_Logo.png' },
  'arizona-state': { name: 'Arizona State', conference: 'Big 12', logo_url: 'https://thesundevils.com/images/logos/Arizona_State.png' },
  'army': { name: 'Army', conference: 'Patriot', logo_url: 'https://goarmywestpoint.com/images/logos/Army_West_Point.png' },
  'auburn': { name: 'Auburn', conference: 'SEC', logo_url: 'https://auburntigers.com/images/logos/Auburn.png' },
  'cal': { name: 'California', conference: 'ACC', logo_url: 'https://calbears.com/images/logos/California.png' },
  'cincinnati': { name: 'Cincinnati', conference: 'Big 12', logo_url: 'https://gobearcats.com/images/logos/Cincinnati.png' },
  'columbia': { name: 'Columbia', conference: 'Ivy', logo_url: 'https://gocolumbialions.com/images/logos/Columbia.png' },
  'cornell': { name: 'Cornell', conference: 'Ivy', logo_url: 'https://cornellbigred.com/images/logos/Cornell.png' },
  'dartmouth': { name: 'Dartmouth', conference: 'Ivy', logo_url: 'https://dartmouthsports.com/images/logos/Dartmouth.png' },
  'duke': { name: 'Duke', conference: 'ACC', logo_url: 'https://goduke.com/images/logos/Duke.png' },
  'florida': { name: 'Florida', conference: 'SEC', logo_url: 'https://floridagators.com/images/logos/Florida.png' },
  'florida-state': { name: 'Florida State', conference: 'ACC', logo_url: 'https://seminoles.com/images/logos/Florida_State.png' },
  'georgia': { name: 'Georgia', conference: 'SEC', logo_url: 'https://georgiadogs.com/images/logos/Georgia.png' },
  'georgia-tech': { name: 'Georgia Tech', conference: 'ACC', logo_url: 'https://ramblinwreck.com/images/logos/Georgia_Tech.png' },
  'harvard': { name: 'Harvard', conference: 'Ivy', logo_url: 'https://gocrimson.com/images/logos/Harvard.png' },
  'indiana': { name: 'Indiana', conference: 'Big Ten', logo_url: 'https://iuhoosiers.com/images/logos/Indiana.png' },
  'iowa': { name: 'Iowa', conference: 'Big Ten', logo_url: 'https://hawkeyesports.com/images/logos/Iowa.png' },
  'kentucky': { name: 'Kentucky', conference: 'SEC', logo_url: 'https://ukathletics.com/images/logos/Kentucky.png' },
  'louisville': { name: 'Louisville', conference: 'ACC', logo_url: 'https://gocards.com/images/logos/Louisville.png' },
  'lsu': { name: 'LSU', conference: 'SEC', logo_url: 'https://lsusports.net/images/logos/LSU.png' },
  'miami': { name: 'Miami', conference: 'ACC', logo_url: 'https://hurricanesports.com/images/logos/Miami.png' },
  'michigan': { name: 'Michigan', conference: 'Big Ten', logo_url: 'https://mgoblue.com/images/logos/Michigan.png' },
  'minnesota': { name: 'Minnesota', conference: 'Big Ten', logo_url: 'https://gophersports.com/images/logos/Minnesota.png' },
  'missouri': { name: 'Missouri', conference: 'SEC', logo_url: 'https://mutigers.com/images/logos/Missouri.png' },
  'navy': { name: 'Navy', conference: 'Patriot', logo_url: 'https://navysports.com/images/logos/Navy.png' },
  'nc-state': { name: 'NC State', conference: 'ACC', logo_url: 'https://gopack.com/images/logos/NC_State.png' },
  'north-carolina': { name: 'North Carolina', conference: 'ACC', logo_url: 'https://goheels.com/images/logos/North_Carolina.png' },
  'northwestern': { name: 'Northwestern', conference: 'Big Ten', logo_url: 'https://nusports.com/images/logos/Northwestern.png' },
  'notre-dame': { name: 'Notre Dame', conference: 'ACC', logo_url: 'https://fightingirish.com/images/logos/Notre_Dame.png' },
  'ohio-state': { name: 'Ohio State', conference: 'Big Ten', logo_url: 'https://ohiostatebuckeyes.com/images/logos/Ohio_State.png' },
  'penn': { name: 'Penn', conference: 'Ivy', logo_url: 'https://pennathletics.com/images/logos/Penn.png' },
  'penn-state': { name: 'Penn State', conference: 'Big Ten', logo_url: 'https://gopsusports.com/images/logos/Penn_State.png' },
  'pittsburgh': { name: 'Pittsburgh', conference: 'ACC', logo_url: 'https://pittsburghpanthers.com/images/logos/Pittsburgh.png' },
  'princeton': { name: 'Princeton', conference: 'Ivy', logo_url: 'https://goprincetontigers.com/images/logos/Princeton.png' },
  'purdue': { name: 'Purdue', conference: 'Big Ten', logo_url: 'https://purduesports.com/images/logos/Purdue.png' },
  'smu': { name: 'SMU', conference: 'ACC', logo_url: 'https://smumustangs.com/images/logos/SMU.png' },
  'south-carolina': { name: 'South Carolina', conference: 'SEC', logo_url: 'https://gamecocksonline.com/images/logos/South_Carolina.png' },
  'stanford': { name: 'Stanford', conference: 'ACC', logo_url: 'https://gostanford.com/images/logos/Stanford.png' },
  'tennessee': { name: 'Tennessee', conference: 'SEC', logo_url: 'https://utsports.com/images/logos/Tennessee.png' },
  'texas': { name: 'Texas', conference: 'SEC', logo_url: 'https://texassports.com/images/logos/Texas.png' },
  'texas-am': { name: 'Texas A&M', conference: 'SEC', logo_url: 'https://12thman.com/images/logos/Texas_A_M.png' },
  'tcu': { name: 'TCU', conference: 'Big 12', logo_url: 'https://gofrogs.com/images/logos/TCU.png' },
  'towson': { name: 'Towson', conference: 'CAA', logo_url: 'https://towsontigers.com/images/logos/Towson.png' },
  'unlv': { name: 'UNLV', conference: 'Mountain West', logo_url: 'https://unlvrebels.com/images/logos/UNLV.png' },
  'usc': { name: 'USC', conference: 'Big Ten', logo_url: 'https://usctrojans.com/images/logos/USC.png' },
  'virginia': { name: 'Virginia', conference: 'ACC', logo_url: 'https://virginiasports.com/images/logos/Virginia.png' },
  'virginia-tech': { name: 'Virginia Tech', conference: 'ACC', logo_url: 'https://hokiesports.com/images/logos/Virginia_Tech.png' },
  'wisconsin': { name: 'Wisconsin', conference: 'Big Ten', logo_url: 'https://uwbadgers.com/images/logos/Wisconsin.png' },
  'yale': { name: 'Yale', conference: 'Ivy', logo_url: 'https://yalebulldogs.com/images/logos/Yale.png' }
};

async function main() {
  console.log('🔄 Starting backup restoration...\n');

  // Load backup data
  const backupPath = '/Users/chace/ncaa-swim-tracker/data/all-rosters.json';
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  console.log(`📦 Backup info:`);
  console.log(`   Date: ${backup.lastUpdated}`);
  console.log(`   Teams: ${backup.totalTeams}`);
  console.log(`   Athletes: ${backup.totalAthletes}\n`);

  // Step 1: Insert teams (without IDs - let Supabase generate UUIDs)
  console.log('1️⃣ Inserting teams...');
  const teamSlugs = [...new Set(backup.athletes.map(a => a.team_id))];
  const teamsToInsert = teamSlugs.map(slug => ({
    name: TEAMS[slug]?.name || slug,
    conference: TEAMS[slug]?.conference || 'Other',
    logo_url: TEAMS[slug]?.logo_url || null,
    conference_display_name: TEAMS[slug]?.conference || 'Other'
  }));

  const { data: insertedTeams, error: teamError } = await supabase
    .from('teams')
    .insert(teamsToInsert)
    .select();

  if (teamError) {
    console.error('❌ Error inserting teams:', teamError);
    return;
  }

  // Create mapping from team name to UUID
  const teamNameToId = {};
  insertedTeams.forEach(team => {
    teamNameToId[team.name] = team.id;
  });

  // Create mapping from slug to UUID
  const slugToId = {};
  teamSlugs.forEach(slug => {
    const teamName = TEAMS[slug]?.name || slug;
    slugToId[slug] = teamNameToId[teamName];
  });

  console.log(`✅ Inserted ${insertedTeams.length} teams\n`);

  // Step 2: Insert athletes in batches
  console.log('2️⃣ Inserting athletes...');
  const athletesToInsert = backup.athletes
    .filter(a => slugToId[a.team_id]) // Only include athletes with valid team mapping
    .map(a => ({
      name: a.name,
      team_id: slugToId[a.team_id], // Use UUID instead of slug
      athlete_type: a.athlete_type || 'Swimmer',
      class_year: a.year || null,
      hometown: a.hometown || null,
      photo_url: a.headshot_url || null,
      profile_url: null
    }));

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < athletesToInsert.length; i += batchSize) {
    const batch = athletesToInsert.slice(i, i + batchSize);
    const { error: athleteError } = await supabase
      .from('athletes')
      .insert(batch);

    if (athleteError) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, athleteError);
      continue;
    }
    inserted += batch.length;
    process.stdout.write(`   Progress: ${inserted}/${athletesToInsert.length} athletes\r`);
  }
  console.log(`\n✅ Inserted ${inserted} athletes\n`);

  // Step 3: Verify
  console.log('3️⃣ Verifying restoration...');
  const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
  const { count: athleteCount } = await supabase.from('athletes').select('*', { count: 'exact', head: true });

  console.log(`   Teams in database: ${teamCount}`);
  console.log(`   Athletes in database: ${athleteCount}\n`);

  console.log('✨ Restoration complete!\n');
  console.log('⚠️  Note: This backup is from January 21st, so it\'s missing:');
  console.log('   - ~4 teams added after that date');
  console.log('   - ~600 athletes added after that date');
  console.log('   - All data quality improvements from Feb 10th\n');
}

main().catch(console.error);
