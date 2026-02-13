require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEAM_FIXES = {
  'George Washington': {
    coaches: ['Chico Rego', 'Christopher Lane', 'Kacie Mollin']
  },
  'Towson': {
    missingHeadshots: ['Aidan Clark', 'Asher Allebach', 'Isak Brkanovic', 'Linus Ament', 'Owen Cather', 'Teddy Ament']
  },
  'UNLV': {
    missingHeadshots: ['Teneka Ash']
  },
  'Southern Illinois': {
    femaleAthletes: [
      'Ale Hoyos Horvath', 'Autumn Milford', 'Bea Padron', 'Brooklyn Anderson',
      'Ellie Shaw', 'Freedom Toll', 'Jocelyn Reynolds', 'Kathryn Chaves',
      'Liseska Gallegos Gutierrez', 'Lívia Munkácsi-Nagy', 'Madalyn Booker',
      'Masha Zhukova', 'Sam Vega', 'Susy Hernandez', 'Tamara De la Torre',
      'Tia Jankovics', 'Zaria Terry'
    ],
    coaches: ['Alec Kandt', 'Chunhua Zhao', 'Geoff Hanson', 'Kelsey Forbord'],
    missingHeadshots: ['Celia Pulido']
  },
  'Army': {
    coaches: ['Alex Cremer', 'Brandt Nigro', 'Eric Wall', 'Kelly Lennon', 'Rita Chyou'],
    missingHeadshots: ['Joseph Frullaney']
  },
  'Penn': {
    missingHeadshots: ['Alex Fu', 'James Curreri', 'Liam Campbell', 'Rohan D\'Souza Larson', 'Truman Armstrong', 'Victor Dang']
  },
  'Brown': {
    coaches: ['Colin Zeng', 'Kevin Norman', 'Matt Tynan']
  },
  'Dartmouth': {
    femaleAthletes: ['Allison Henry'],
    coaches: ['Betsy Perron', 'Blair Bish', 'Chris Hamilton', 'Mallory Poole', 'Michael  Derosier', 'Milana Socha', 'Taurian Houston'],
    missingHeadshots: ['Hakan Tell']
  },
  'Columbia': {
    coaches: ['Gustavo Leal', 'Jim Bolster', 'Nathan Freeman', 'Nathan Jacobbe', 'Scott Donie'],
    missingHeadshots: ['Derrick Butts']
  },
  'Princeton': {
    coaches: [
      'David Buschman', 'Jason Fleischer', 'Jason Klugman', 'Kathleen Nolan',
      'Matt Crispino', 'Mia Nonnenberg', 'Michele Aversa', 'Sean Ryder',
      'Ted Everett', 'Yibin Kang'
    ]
  }
};

async function fixTeam(teamName, fixes) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Processing: ${teamName}`);
  console.log('='.repeat(50));

  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', teamName)
    .maybeSingle();

  if (!team) {
    console.error(`❌ Team not found: ${teamName}`);
    return { coaches: 0, females: 0, headshots: 0 };
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

        if (!error) {
          console.log(`  ✅ ${name}`);
          coachesRemoved++;
        } else {
          console.log(`  ❌ ${name}: ${error.message}`);
        }
      } else {
        console.log(`  ⚠️  ${name}: Not found`);
      }
    }
  }

  // Remove female athletes
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

        if (!error) {
          console.log(`  ✅ ${name}`);
          femalesRemoved++;
        } else {
          console.log(`  ❌ ${name}: ${error.message}`);
        }
      } else {
        console.log(`  ⚠️  ${name}: Not found`);
      }
    }
  }

  // Fix missing headshots
  if (fixes.missingHeadshots && fixes.missingHeadshots.length > 0) {
    console.log('\n--- Fixing Missing Headshots ---');
    for (const name of fixes.missingHeadshots) {
      const { data: athlete } = await supabase
        .from('athletes')
        .select('id, name')
        .eq('team_id', team.id)
        .eq('name', name)
        .maybeSingle();

      if (athlete) {
        const { error } = await supabase
          .from('athletes')
          .update({ photo_url: null })
          .eq('id', athlete.id);

        if (!error) {
          console.log(`  ✅ ${name}`);
          headshotsFixed++;
        } else {
          console.log(`  ❌ ${name}: ${error.message}`);
        }
      } else {
        console.log(`  ⚠️  ${name}: Not found`);
      }
    }
  }

  // Update athlete count
  const { data: remaining } = await supabase
    .from('athletes')
    .select('id', { count: 'exact' })
    .eq('team_id', team.id);

  const newCount = remaining?.length || 0;
  await supabase
    .from('teams')
    .update({ athlete_count: newCount })
    .eq('id', team.id);

  console.log(`\n📊 ${teamName} Summary:`);
  if (fixes.coaches) console.log(`   Coaches removed: ${coachesRemoved}/${fixes.coaches.length}`);
  if (fixes.femaleAthletes) console.log(`   Females removed: ${femalesRemoved}/${fixes.femaleAthletes.length}`);
  if (fixes.missingHeadshots) console.log(`   Headshots fixed: ${headshotsFixed}/${fixes.missingHeadshots.length}`);
  console.log(`   New athlete count: ${newCount}`);

  return { coaches: coachesRemoved, females: femalesRemoved, headshots: headshotsFixed };
}

async function fixAllTeams() {
  console.log('Fixing additional team data quality issues...\n');

  let totalCoaches = 0;
  let totalFemales = 0;
  let totalHeadshots = 0;

  for (const [teamName, fixes] of Object.entries(TEAM_FIXES)) {
    const results = await fixTeam(teamName, fixes);
    totalCoaches += results.coaches;
    totalFemales += results.females;
    totalHeadshots += results.headshots;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('✅ All teams processed!');
  console.log('='.repeat(50));
  console.log(`Total coaches removed: ${totalCoaches}`);
  console.log(`Total female athletes removed: ${totalFemales}`);
  console.log(`Total headshots fixed: ${totalHeadshots}`);
}

fixAllTeams().catch(console.error);
