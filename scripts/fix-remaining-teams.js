require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEAM_FIXES = {
  'Indiana': {
    coaches: [
      'Colette Bell',
      'Cory Chitwood',
      'Eric Best',
      'Drew Johansen',
      'Luke Ryan',
      'Noelle Peplowski',
      'Ray Looze'
    ],
    missingHeadshots: [
      'Aaron Shackell',
      'Colin Kostbade',
      'Paul Kelley',
      'Will Sowle'
    ]
  },
  'Minnesota': {
    coaches: [
      'Kelly Kremer',
      'Maddy Olson',
      'Michael Hampel',
      'Stacy Busack',
      'Wenbo Chen'
    ],
    missingHeadshots: [
      'Zach Mertens',
      'Zachary Hawley'
    ]
  },
  'Northwestern': {
    coaches: [
      'Eddie Larios',
      'Jacob Siar',
      'Kris Jorgensen',
      'Mario McDonald',
      'Matthew Lowe'
    ],
    missingHeadshots: []
  },
  'Wisconsin': {
    coaches: [
      'Billy Breider',
      'Jennah Haney',
      'Johno  Fergusson',
      'Jack Brown',
      'Ted Patton'
    ],
    missingHeadshots: []
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
  if (fixes.coaches && fixes.coaches.length > 0) {
    console.log(`   Coaches removed: ${coachesRemoved}/${fixes.coaches.length}`);
  }
  if (fixes.missingHeadshots && fixes.missingHeadshots.length > 0) {
    console.log(`   Headshots fixed: ${headshotsFixed}/${fixes.missingHeadshots.length}`);
  }
  console.log(`   New athlete count: ${newCount}`);
}

async function fixAllTeams() {
  console.log('Fixing remaining team data quality issues...\n');

  for (const [teamName, fixes] of Object.entries(TEAM_FIXES)) {
    await fixTeam(teamName, fixes);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('✅ All remaining teams processed!');
  console.log('='.repeat(50));
}

fixAllTeams().catch(console.error);
