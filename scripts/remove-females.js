require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const femaleNames = [
  'abigail', 'amanda', 'amy', 'andrea', 'angela', 'anna', 'annika', 'ashley', 'audrey',
  'bella', 'brittany', 'carissa', 'casey', 'chloe', 'christina', 'claire', 'coco',
  'daniela', 'danielle', 'elizabeth', 'elizaveta', 'ellis', 'emily', 'emma',
  'hanna', 'hannah', 'heather', 'izzy', 'jennifer', 'jessica', 'julia', 'juliette',
  'kate', 'katie', 'kayla', 'kiia', 'kyla', 'kyleigh',
  'lilly', 'lindsay', 'lora', 'maggie', 'maria', 'mary', 'megan', 'michelle', 'morgan',
  'nicole', 'nora', 'olivia', 'rachel', 'rebecca', 'rosalie', 'sammie', 'samantha',
  'sarah', 'sophia', 'stephanie', 'taylor', 'tiffany', 'wyllo', 'zoey', 'ava',
  'allyson', 'ella', 'eloise', 'giulia', 'halina', 'kailey', 'kaitlyn', 'kaylee',
  'lillie', 'lydia', 'macy', 'victoria', 'reagan', 'joslyn', 'julie', 'gabby',
  'bridget', 'blaire', 'celina', 'alexandria', 'alexis', 'alyssa', 'amber', 'bailey',
  'bethany', 'briana', 'brooke', 'camila', 'caroline', 'catherine', 'charlotte', 'chelsey',
  'christine', 'courtney', 'crystal', 'diana', 'donna', 'elena', 'eliza', 'erica',
  'erin', 'gabriela', 'grace', 'haley', 'holly', 'isabella', 'jasmine', 'jenna',
  'jillian', 'jordan', 'karen', 'kimberly', 'kristen', 'kristin', 'laura', 'lauren',
  'leah', 'leslie', 'lily', 'lisa', 'madison', 'margaret', 'melissa', 'molly',
  'natalie', 'nina', 'paige', 'patricia', 'penny', 'sierra', 'sydney', 'teresa',
  'tessa', 'vanessa', 'veronica', 'whitney'
];

function isPossiblyFemale(name) {
  const firstName = name.toLowerCase().split(' ')[0];
  return femaleNames.includes(firstName);
}

async function removeFemales() {
  // Get all athletes (no limit, fetch everything)
  let allAthletes = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data: athletes, error } = await supabase
      .from('athletes')
      .select('id, name, team_id')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching athletes:', error);
      return;
    }

    if (!athletes || athletes.length === 0) break;

    allAthletes = allAthletes.concat(athletes);
    if (athletes.length < pageSize) break;
    page++;
  }

  console.log(`\nChecking ${allAthletes.length} total athletes...\n`);
  const athletes = allAthletes;

  // Group by team for reporting
  const femalesByTeam = {};
  const femalesToDelete = [];

  for (const athlete of athletes) {
    if (isPossiblyFemale(athlete.name)) {
      femalesToDelete.push(athlete);

      if (!femalesByTeam[athlete.team_id]) {
        femalesByTeam[athlete.team_id] = [];
      }
      femalesByTeam[athlete.team_id].push(athlete.name);
    }
  }

  console.log(`Found ${femalesToDelete.length} female athletes to remove:\n`);

  // Get team names for reporting
  for (const teamId in femalesByTeam) {
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();

    console.log(`${team?.name || 'Unknown'} (${femalesByTeam[teamId].length}):`);
    femalesByTeam[teamId].forEach(name => console.log(`  - ${name}`));
    console.log('');
  }

  // Delete all female athletes
  const idsToDelete = femalesToDelete.map(a => a.id);

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('athletes')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('Error deleting athletes:', deleteError);
      return;
    }

    console.log(`✅ Successfully removed ${idsToDelete.length} female athletes`);
  } else {
    console.log('No female athletes found.');
  }
}

removeFemales();
