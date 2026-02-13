require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function compareTeams() {
  // Get teams from new table
  const { data: newTeams } = await supabase
    .from('teams')
    .select('name, conference')
    .order('name');
  
  // Get unique teams from old table
  const { data: oldAthletes } = await supabase
    .from('swim_athletes')
    .select('team_id');
  
  const oldTeamSlugs = [...new Set(oldAthletes.map(a => a.team_id))].sort();
  
  console.log('='.repeat(70));
  console.log('TEAM COMPARISON');
  console.log('='.repeat(70));
  console.log(`\nNew teams table: ${newTeams.length} teams`);
  console.log(`Old swim_athletes table: ${oldTeamSlugs.length} unique teams\n`);
  
  // Count by conference in new table
  const confCounts = {};
  newTeams.forEach(t => {
    confCounts[t.conference] = (confCounts[t.conference] || 0) + 1;
  });
  
  console.log('New table by conference:');
  Object.entries(confCounts).sort((a, b) => b[1] - a[1]).forEach(([conf, count]) => {
    console.log(`  ${conf.toUpperCase()}: ${count} teams`);
  });
  
  console.log('\n='.repeat(70));
  console.log('Teams in OLD table but NOT in NEW table:');
  console.log('='.repeat(70));
  
  const newTeamNames = newTeams.map(t => t.name.toLowerCase());
  const teamSlugToName = {
    'alabama': 'Alabama',
    'arizona': 'Arizona',
    'arizona-state': 'Arizona State',
    'army': 'Army',
    'auburn': 'Auburn',
    'boston-college': 'Boston College',
    'brown': 'Brown',
    'cal': 'Cal',
    'columbia': 'Columbia',
    'cornell': 'Cornell',
    'dartmouth': 'Dartmouth',
    'duke': 'Duke',
    'florida': 'Florida',
    'florida-state': 'Florida State',
    'george-washington': 'George Washington',
    'georgia': 'Georgia',
    'georgia-tech': 'Georgia Tech',
    'harvard': 'Harvard',
    'indiana': 'Indiana',
    'kentucky': 'Kentucky',
    'louisville': 'Louisville',
    'lsu': 'LSU',
    'michigan': 'Michigan',
    'minnesota': 'Minnesota',
    'missouri': 'Missouri',
    'navy': 'Navy',
    'nc-state': 'NC State',
    'north-carolina': 'North Carolina',
    'northwestern': 'Northwestern',
    'notre-dame': 'Notre Dame',
    'ohio-state': 'Ohio State',
    'penn': 'Penn',
    'penn-state': 'Penn State',
    'pittsburgh': 'Pittsburgh',
    'princeton': 'Princeton',
    'purdue': 'Purdue',
    'south-carolina': 'South Carolina',
    'southern-illinois': 'Southern Illinois',
    'stanford': 'Stanford',
    'tcu': 'TCU',
    'tennessee': 'Tennessee',
    'texas': 'Texas',
    'texas-am': 'Texas A&M',
    'towson': 'Towson',
    'unlv': 'UNLV',
    'usc': 'USC',
    'utah': 'Utah',
    'uva': 'Virginia',
    'virginia-tech': 'Virginia Tech',
    'west-virginia': 'West Virginia',
    'wisconsin': 'Wisconsin',
    'yale': 'Yale'
  };
  
  const missingTeams = [];
  oldTeamSlugs.forEach(slug => {
    const name = teamSlugToName[slug];
    if (name && !newTeamNames.includes(name.toLowerCase())) {
      missingTeams.push(name);
    }
  });
  
  if (missingTeams.length > 0) {
    missingTeams.forEach(name => console.log(`  - ${name}`));
  } else {
    console.log('  (All old teams are in new table)');
  }
  
  console.log('\n='.repeat(70));
  console.log('NEW table teams:');
  console.log('='.repeat(70));
  newTeams.forEach(t => {
    console.log(`  ${t.name} (${t.conference.toUpperCase()})`);
  });
  
  console.log('\n='.repeat(70));
  console.log('OLD table team slugs:');
  console.log('='.repeat(70));
  oldTeamSlugs.forEach(slug => {
    console.log(`  ${slug} -> ${teamSlugToName[slug] || 'UNKNOWN'}`);
  });
}

compareTeams();
