require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔍 CHECKING: LSU Data Issues\n');

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .eq('name', 'LSU')
    .single();

  if (teamError || !team) {
    console.log('❌ Error finding LSU team:', teamError?.message || 'Team not found');
    return;
  }

  console.log(`✅ Found team: ${team.name} (ID: ${team.id.substring(0, 8)}...)\n`);

  const { data: athletes, error: athletesError } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  if (athletesError) {
    console.log('❌ Error fetching athletes:', athletesError.message);
    return;
  }

  if (!athletes || athletes.length === 0) {
    console.log('⚠️  No athletes found for LSU');
    return;
  }

  console.log(`Total athletes: ${athletes.length}\n`);

  // Check for duplicates
  const nameCount = {};
  athletes.forEach(a => {
    const name = a.name.trim();
    nameCount[name] = (nameCount[name] || 0) + 1;
  });

  const duplicates = Object.entries(nameCount).filter(([name, count]) => count > 1);
  
  console.log(`${'='.repeat(70)}`);
  console.log('DUPLICATES');
  console.log('='.repeat(70));
  if (duplicates.length > 0) {
    duplicates.forEach(([name, count]) => {
      console.log(`\n${name} (${count} entries):`);
      const dupes = athletes.filter(a => a.name.trim() === name);
      dupes.forEach(d => {
        console.log(`  - ID: ${d.id.substring(0, 8)}...`);
        console.log(`    Photo: ${d.photo_url?.substring(0, 60) || 'None'}...`);
      });
    });
  } else {
    console.log('No duplicates found');
  }

  // Check for missing headshots
  const missingHeadshots = athletes.filter(a => 
    !a.photo_url || 
    a.photo_url === team.logo_url ||
    a.photo_url.includes('/logos/')
  );

  console.log(`\n${'='.repeat(70)}`);
  console.log('MISSING HEADSHOTS');
  console.log('='.repeat(70));
  console.log(`${missingHeadshots.length}/${athletes.length} athletes missing headshots\n`);

  missingHeadshots.forEach(a => {
    console.log(`- ${a.name}`);
  });
}

main();
