require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Auburn's placeholder imgproxy hash
const AUBURN_PLACEHOLDER_HASH = 'p2BRDbNwV4T0rJKg3dpWVFeGf1ibNvVuFxAGEdnfJno';

async function fixAuburnPlaceholders() {
  console.log('Fixing Auburn placeholder images...\n');

  // Get Auburn team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Auburn')
    .single();

  if (!team) {
    console.error('Auburn team not found');
    return;
  }

  console.log(`Found team: ${team.name} (ID: ${team.id})\n`);

  // Get all Auburn athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id);

  const placeholderAthletes = athletes.filter(a =>
    a.photo_url && a.photo_url.includes(AUBURN_PLACEHOLDER_HASH)
  );

  console.log(`Found ${placeholderAthletes.length} athletes with placeholder images:\n`);
  placeholderAthletes.forEach(a => console.log(`  - ${a.name}`));

  console.log('\nUpdating to use team logo fallback...\n');

  let updated = 0;
  for (const athlete of placeholderAthletes) {
    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: null })
      .eq('id', athlete.id);

    if (error) {
      console.error(`❌ Error updating ${athlete.name}: ${error.message}`);
    } else {
      console.log(`✅ Updated: ${athlete.name}`);
      updated++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total placeholders found: ${placeholderAthletes.length}`);
}

fixAuburnPlaceholders().catch(console.error);
