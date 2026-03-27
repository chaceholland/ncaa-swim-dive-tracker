require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeam(teamName) {
  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`${teamName}: NOT FOUND`);
    return;
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url, profile_url')
    .eq('team_id', team.id)
    .limit(1)
    .single();

  if (!athletes) {
    console.log(`${teamName}: No athletes`);
    return;
  }

  const hasAccLogo = athletes.photo_url?.includes('header_logo_conf_acc');
  const hasProfileUrl = !!athletes.profile_url;

  console.log(`${teamName}:`);
  console.log(`  Photo: ${hasAccLogo ? '[ACC LOGO]' : athletes.photo_url?.substring(0, 60) || 'NULL'}`);
  console.log(`  Profile URL: ${hasProfileUrl ? 'YES' : 'NO'}`);
}

async function main() {
  console.log('\nChecking ACC Teams:\n');

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
    'Miami',
    'Georgia Tech',
    'Clemson',
    'Florida State',
    'Notre Dame',
    'Pittsburgh'
  ];

  for (const team of accTeams) {
    await checkTeam(team);
  }
}

main();
