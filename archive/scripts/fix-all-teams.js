require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEAM_FIXES = {
  'Texas': {
    coaches: ['Erik Posegay'],
    missingHeadshots: []
  },
  'Florida': {
    coaches: [
      'Alex Dehner',
      'Anthony Nesty',
      'Bryan Gillooly',
      'Erva Gilliam',
      'Laurent Perez Gillooly',
      'Mike Spiegler',
      'Tim Aydt',
      'Tracy Zimmer'
    ],
    missingHeadshots: ['Jack Neiman']
  },
  'Texas A&M': {
    coaches: [
      'Duncan Sherrard',
      'Gerald Peña',
      'Jay Lerew',
      'Jeff Bro',
      'Wes Foltz'
    ],
    femaleAthletes: [
      'Corbyn Reyes',
      'Hayden Miller',
      'Ophir Rakah'
    ],
    missingHeadshots: ['Emilio Trevino Laureano']
  },
  'Tennessee': {
    coaches: [
      'Devin Gilbert',
      'Dr. Joe Whitney',
      'Greg Adamson',
      'Jane Figueiredo',
      'Michael Wright',
      'Matt Kredich',
      'Rich Murphy',
      'Rob Collins'
    ],
    missingHeadshots: [
      'Kristina Klemenz',
      'Lúcio Paula',
      'Thomas Ciprick',
      'Ulises Saravia'
    ]
  }
};

async function fixTeam(teamName, fixes) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Processing: ${teamName}`);
  console.log('='.repeat(50));

  // Get team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.error(`❌ Team not found: ${teamName}`);
    return;
  }

  console.log(`Found team: ${team.name} (ID: ${team.id})\n`);

  let coachesRemoved = 0;
  let femalesRemoved = 0;
  let headshotsFixed = 0;

  // Remove coaches
  if (fixes.coaches && fixes.coaches.length > 0) {
    console.log('--- Removing Coaches ---');
    for (const name of fixes.coaches) {
      const { data: coach } = await supabase
        .from('athletes')
        .select('id, name')
        .eq('team_id', team.id)
        .eq('name', name)
        .maybeSingle();

      if (coach) {
        const { error } = await supabase
          .from('athletes')
          .delete()
          .eq('id', coach.id);

        if (error) {
          console.error(`  ❌ Error removing ${name}: ${error.message}`);
        } else {
          console.log(`  ✅ Removed coach: ${name}`);
          coachesRemoved++;
        }
      } else {
        console.log(`  ⚠️  Not found: ${name}`);
      }
    }
  }

  // Remove female athletes (in men's team)
  if (fixes.femaleAthletes && fixes.femaleAthletes.length > 0) {
    console.log('\n--- Removing Female Athletes ---');
    for (const name of fixes.femaleAthletes) {
      const { data: athlete } = await supabase
        .from('athletes')
        .select('id, name')
        .eq('team_id', team.id)
        .eq('name', name)
        .maybeSingle();

      if (athlete) {
        const { error } = await supabase
          .from('athletes')
          .delete()
          .eq('id', athlete.id);

        if (error) {
          console.error(`  ❌ Error removing ${name}: ${error.message}`);
        } else {
          console.log(`  ✅ Removed female athlete: ${name}`);
          femalesRemoved++;
        }
      } else {
        console.log(`  ⚠️  Not found: ${name}`);
      }
    }
  }

  // Fix missing headshots
  if (fixes.missingHeadshots && fixes.missingHeadshots.length > 0) {
    console.log('\n--- Fixing Missing Headshots ---');
    for (const name of fixes.missingHeadshots) {
      const { data: athlete } = await supabase
        .from('athletes')
        .select('id, name, photo_url')
        .eq('team_id', team.id)
        .eq('name', name)
        .maybeSingle();

      if (athlete) {
        const { error } = await supabase
          .from('athletes')
          .update({ photo_url: null })
          .eq('id', athlete.id);

        if (error) {
          console.error(`  ❌ Error updating ${name}: ${error.message}`);
        } else {
          console.log(`  ✅ Fixed headshot: ${name}`);
          headshotsFixed++;
        }
      } else {
        console.log(`  ⚠️  Not found: ${name}`);
      }
    }
  }

  // Update athlete count
  const { data: remainingAthletes } = await supabase
    .from('athletes')
    .select('id', { count: 'exact' })
    .eq('team_id', team.id);

  const newCount = remainingAthletes?.length || 0;

  await supabase
    .from('teams')
    .update({ athlete_count: newCount })
    .eq('id', team.id);

  console.log(`\n📊 ${teamName} Summary:`);
  if (fixes.coaches) console.log(`   Coaches removed: ${coachesRemoved}/${fixes.coaches.length}`);
  if (fixes.femaleAthletes) console.log(`   Female athletes removed: ${femalesRemoved}/${fixes.femaleAthletes.length}`);
  if (fixes.missingHeadshots) console.log(`   Headshots fixed: ${headshotsFixed}/${fixes.missingHeadshots.length}`);
  console.log(`   New athlete count: ${newCount}`);
}

async function fixAllTeams() {
  console.log('Fixing data quality issues across all teams...\n');

  for (const [teamName, fixes] of Object.entries(TEAM_FIXES)) {
    await fixTeam(teamName, fixes);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('✅ All teams processed!');
  console.log('='.repeat(50));
}

fixAllTeams().catch(console.error);
