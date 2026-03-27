require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPennStateLogos() {
  console.log('Fixing Penn State Pepsi logo issue...\n');

  // Get Penn State team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Penn State')
    .single();

  if (!team) {
    console.error('Penn State team not found');
    return;
  }

  console.log(`Found team: ${team.name} (ID: ${team.id})\n`);

  // Find all athletes with the Pepsi logo
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%pepsi-logo%');

  console.log(`Found ${athletes.length} athletes with Pepsi logo\n`);

  let updated = 0;
  for (const athlete of athletes) {
    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: null })
      .eq('id', athlete.id);

    if (error) {
      console.error(`❌ Error updating ${athlete.name}: ${error.message}`);
    } else {
      console.log(`✅ Fixed: ${athlete.name}`);
      updated++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${athletes.length}`);
  console.log(`\n⚠️  Penn State doesn't have individual athlete photos on their website.`);
  console.log(`   All athletes will display the Penn State team logo instead.`);
}

fixPennStateLogos().catch(console.error);
