require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findTrulyMissing() {
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

  console.log('Checking athletes for missing headshots...\n');

  const missing = [];
  const teamGroups = {};

  for (const name of athleteNames) {
    const { data: athlete } = await supabase
      .from('athletes')
      .select('id, name, photo_url, team_id')
      .eq('name', name)
      .maybeSingle();

    if (athlete) {
      const { data: team } = await supabase
        .from('teams')
        .select('name, logo_url')
        .eq('id', athlete.team_id)
        .single();

      if (!athlete.photo_url) {
        missing.push({ ...athlete, teamName: team.name, logoUrl: team.logo_url });
        if (!teamGroups[team.name]) {
          teamGroups[team.name] = [];
        }
        teamGroups[team.name].push(athlete);
      }
    }
  }

  if (missing.length === 0) {
    console.log('✅ All athletes from the list have photos!');
    return;
  }

  console.log(`Found ${missing.length} athletes without photos:\n`);

  Object.entries(teamGroups).forEach(([teamName, athletes]) => {
    console.log(`${teamName}: ${athletes.length} athletes`);
    athletes.forEach(a => console.log(`  - ${a.name}`));
    console.log('');
  });

  return missing;
}

findTrulyMissing().then(missing => {
  if (missing && missing.length > 0) {
    console.log('\nReady to update these athletes to use team logos');
  }
});
