require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Men's athlete IDs from 2025-26 combined roster
const MEN_IDS = new Set([
  17206, 17207, 17209, 17216, 17221, 17223, 17228, 17229,
  17241, 17244, 17245, 17246, 17247, 17249, 17250, 17255,
  17258, 17269, 17270, 17272, 17273, 17274, 17275, 17276
]);

async function main() {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'UNLV')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, profile_url')
    .eq('team_id', team.id);

  console.log(`Total UNLV athletes: ${athletes.length}\n`);

  const toDelete = [];
  const toKeep = [];

  for (const a of athletes) {
    // Extract numeric ID from profile_url if present
    const athleteId = a.profile_url
      ? parseInt(a.profile_url.split('/').pop(), 10)
      : NaN;

    if (MEN_IDS.has(athleteId)) {
      toKeep.push(a.name);
    } else {
      toDelete.push({ id: a.id, name: a.name, profile_url: a.profile_url });
    }
  }

  console.log(`Keeping ${toKeep.length} men's athletes:`);
  toKeep.forEach(n => console.log(`  ✅ ${n}`));

  console.log(`\nDeleting ${toDelete.length} non-men's athletes:`);
  toDelete.forEach(a => console.log(`  ❌ ${a.name} (${a.profile_url || 'no profile_url'})`));

  if (toDelete.length > 0) {
    const ids = toDelete.map(a => a.id);
    const { error } = await supabase
      .from('athletes')
      .delete()
      .in('id', ids);

    if (error) console.log(`\nError: ${error.message}`);
    else console.log(`\nDeleted ${toDelete.length} athletes.`);
  }
}

main();
