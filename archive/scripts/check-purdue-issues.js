require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔍 CHECKING: Purdue Data Issues\n');

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .eq('name', 'Purdue')
    .single();

  if (teamError || !team) {
    console.log('❌ Error finding Purdue team:', teamError?.message || 'Team not found');
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
    console.log('⚠️  No athletes found for Purdue');
    return;
  }

  console.log(`Total athletes: ${athletes.length}\n`);

  // Check for duplicate names
  const nameCount = {};
  athletes.forEach(a => {
    const name = a.name.trim();
    nameCount[name] = (nameCount[name] || 0) + 1;
  });

  const duplicateNames = Object.entries(nameCount).filter(([name, count]) => count > 1);

  console.log(`${'='.repeat(70)}`);
  console.log('DUPLICATE NAMES');
  console.log('='.repeat(70));
  if (duplicateNames.length > 0) {
    duplicateNames.forEach(([name, count]) => {
      console.log(`\n${name} (${count} entries):`);
      const dupes = athletes.filter(a => a.name.trim() === name);
      dupes.forEach(d => {
        console.log(`  - ID: ${d.id.substring(0, 8)}...`);
        console.log(`    Photo: ${d.photo_url?.substring(0, 80) || 'None'}...`);
      });
    });
  } else {
    console.log('No duplicate names found');
  }

  // Check for duplicate photo URLs
  const photoCount = {};
  athletes.forEach(a => {
    if (a.photo_url && a.photo_url !== team.logo_url) {
      photoCount[a.photo_url] = (photoCount[a.photo_url] || []);
      photoCount[a.photo_url].push(a.name);
    }
  });

  const duplicatePhotos = Object.entries(photoCount).filter(([url, names]) => names.length > 1);

  console.log(`\n${'='.repeat(70)}`);
  console.log('DUPLICATE PHOTO URLs');
  console.log('='.repeat(70));
  if (duplicatePhotos.length > 0) {
    duplicatePhotos.forEach(([url, names]) => {
      console.log(`\n${url.substring(0, 80)}...`);
      console.log(`Used by ${names.length} athletes:`);
      names.forEach(name => console.log(`  - ${name}`));
    });
  } else {
    console.log('No duplicate photo URLs found');
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
