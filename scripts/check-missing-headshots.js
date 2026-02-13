require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissingHeadshots() {
  const athleteNames = [
    'Aaron Shackell', 'Colin Kostbade', 'Paul Kelley', 'Will Sowle',
    'Aleksandar Beljic',
    'Zach Mertens', 'Zachary Hawley',
    'Aidan Clark', 'Asher Allebach', 'Isak Brkanovic', 'Linus Ament', 'Owen Cather', 'Teddy Ament',
    'Joseph Frullaney',
    'Alex Fu', 'James Curreri', 'Liam Campbell', "Rohan D'Souza Larson", 'Truman Armstrong', 'Victor Dang',
    'Hakan Tell',
    'Derrick Butts',
    'Emilio Trevino Laureano',
    'Jack Neiman',
    'Lúcio Paula', 'Thomas Ciprick', 'Ulises Saravia',
    'Alexander Cole', 'Alex Hotta', 'Zach Welsh', 'Will Jost', 'Tyler Wills', 'Sam White', 'Max Miller', 'Matt Rose', 'Mason Kajfosz', 'Lucas Byrd', 'Evan Mackesy', 'Dylan Burau', 'Chris Bartmess', 'Charles Lee', 'Blake Rowe'
  ];

  const teamCounts = {};
  const athletesByTeam = {};

  for (const name of athleteNames) {
    const { data: athlete } = await supabase
      .from('athletes')
      .select('id, name, photo_url, team_id, profile_url')
      .eq('name', name)
      .maybeSingle();

    if (athlete) {
      const { data: team } = await supabase
        .from('teams')
        .select('name, logo_url')
        .eq('id', athlete.team_id)
        .single();

      if (!athlete.photo_url || athlete.photo_url.includes('placeholder')) {
        teamCounts[team.name] = (teamCounts[team.name] || 0) + 1;
        if (!athletesByTeam[team.name]) {
          athletesByTeam[team.name] = [];
        }
        athletesByTeam[team.name].push({
          id: athlete.id,
          name: athlete.name,
          profile_url: athlete.profile_url,
          team_id: athlete.team_id,
          logo_url: team.logo_url
        });
      }
    }
  }

  console.log('Teams with missing headshots:\n');
  Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, count]) => {
      console.log(`  ${team}: ${count} athletes`);
    });

  return athletesByTeam;
}

checkMissingHeadshots().then(athletesByTeam => {
  global.athletesByTeam = athletesByTeam;
  console.log('\nData stored in global.athletesByTeam');
});
