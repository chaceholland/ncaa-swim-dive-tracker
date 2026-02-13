require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// USC athletes with photo issues
const PHOTO_ISSUES = [
  'Angelyne Loiselle',  // Dummy placeholder
  'Aleksandar Beljic',  // Wrong photo
];

// Coaches incorrectly listed as athletes
const COACHES_TO_REMOVE = [
  'Doerte Lindner',
  'Hongping Li',
  'Gia Larez',
  'Keith Dawley',
  'Kevin Rapien',
  'Lea Maurer',
  'Meghan Hawthorne',
];

async function fixUSCIssues() {
  console.log('Fixing USC data quality issues...\n');

  // Get USC team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'USC')
    .single();

  if (!team) {
    console.error('USC team not found');
    return;
  }

  console.log(`Found team: ${team.name} (ID: ${team.id})\n`);

  // Fix photo issues
  console.log('=== Fixing Photo Issues ===\n');
  let photosFixed = 0;
  for (const name of PHOTO_ISSUES) {
    const { data: athlete } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id)
      .eq('name', name)
      .single();

    if (athlete) {
      const { error } = await supabase
        .from('athletes')
        .update({ photo_url: null })
        .eq('id', athlete.id);

      if (error) {
        console.error(`❌ Error updating ${name}: ${error.message}`);
      } else {
        console.log(`✅ Fixed photo: ${name}`);
        photosFixed++;
      }
    } else {
      console.log(`⚠️  Not found: ${name}`);
    }
  }

  // Remove coaches
  console.log('\n=== Removing Coaches ===\n');
  let coachesRemoved = 0;
  for (const name of COACHES_TO_REMOVE) {
    const { data: coach } = await supabase
      .from('athletes')
      .select('id, name')
      .eq('team_id', team.id)
      .eq('name', name)
      .single();

    if (coach) {
      const { error } = await supabase
        .from('athletes')
        .delete()
        .eq('id', coach.id);

      if (error) {
        console.error(`❌ Error removing ${name}: ${error.message}`);
      } else {
        console.log(`✅ Removed coach: ${name}`);
        coachesRemoved++;
      }
    } else {
      console.log(`⚠️  Not found: ${name}`);
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

  console.log(`\n📊 Summary:`);
  console.log(`   Photos fixed: ${photosFixed}/${PHOTO_ISSUES.length}`);
  console.log(`   Coaches removed: ${coachesRemoved}/${COACHES_TO_REMOVE.length}`);
  console.log(`   New athlete count: ${newCount}`);
}

fixUSCIssues().catch(console.error);
