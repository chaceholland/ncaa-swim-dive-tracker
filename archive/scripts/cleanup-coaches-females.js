require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Coaches and staff to remove
const COACHES_TO_REMOVE = [
  // Ohio State
  'Brian Schrader', 'Justin Sochor', 'Nathan Quebedeaux', 'Ryan Sprague',
  // Utah
  'Cody Lockling', 'Jesse Gallager', 'Jonas Persson', 'Jos Smith', 'Keith  Embray',
  'Logan Andrews', 'Richard Marschner', 'Sabine Krautgasser-Tolman', 'Tami Johnson',
  // West Virginia
  'Brent MacDonald', 'Easton Nelson', 'James Washbish', 'Matt O\'Neill',
  'Michael Walker', 'Natasha Oakes',
  // Cal
  'Eduardo Moraes',
  // Virginia
  'Gary Taylor', 'Jake Shrum', 'Logan Redondo', 'Todd DeSorbo', 'Tyler Fenwick',
  // NC State
  'Jake Cunningham', 'John Abbatoy', 'Josh Stanfield', 'Kevin Happ',
  // Florida State
  'Kyle Cormier', 'Stephen Parker',
  // Virginia Tech
  'Danny White', 'Eric Hale', 'Jordan Kittle, MS, LAT, ATC, PES, CES',
  'Mason Revis', 'Ryan Hawkins',
  // North Carolina
  'Jon Lamb', 'Mark Gangloff', 'Alex Hall', 'Andrew Eckhart',
  // Duke
  'Daniel Graber', 'Brian Barnes',
  // Louisville
  'Jason Dierking', 'Kevin Arakaki'
];

// Female athletes to remove
const FEMALES_TO_REMOVE = [
  'Tyler Driscoll',  // NC State
  'Tom Mienis'       // North Carolina
];

async function main() {
  console.log('\n🧹 CLEANING UP COACHES AND FEMALE ATHLETES\n');

  let totalRemoved = 0;

  // Remove coaches
  console.log('Removing coaches and staff...\n');
  for (const coachName of COACHES_TO_REMOVE) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, team_id')
      .ilike('name', coachName);

    if (athletes && athletes.length > 0) {
      for (const athlete of athletes) {
        // Get team name
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', athlete.team_id)
          .single();

        console.log(`  Removing: ${athlete.name} (${team?.name || 'Unknown'})`);

        await supabase
          .from('athletes')
          .delete()
          .eq('id', athlete.id);

        totalRemoved++;
      }
    }
  }

  // Remove female athletes
  console.log('\nRemoving female athletes...\n');
  for (const femaleName of FEMALES_TO_REMOVE) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, team_id')
      .ilike('name', femaleName);

    if (athletes && athletes.length > 0) {
      for (const athlete of athletes) {
        // Get team name
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', athlete.team_id)
          .single();

        console.log(`  Removing: ${athlete.name} (${team?.name || 'Unknown'})`);

        await supabase
          .from('athletes')
          .delete()
          .eq('id', athlete.id);

        totalRemoved++;
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ CLEANUP COMPLETE: ${totalRemoved} entries removed`);
  console.log('='.repeat(70));
}

main();
