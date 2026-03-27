require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const teams = ['Auburn', 'South Carolina', 'LSU', 'Kentucky'];

  console.log('\nHEADSHOT STATUS SUMMARY\n');
  console.log('='.repeat(70));

  for (const teamName of teams) {
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('name', teamName)
      .single();

    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id);

    const withPhotos = athletes.filter(a =>
      a.photo_url &&
      !a.photo_url.includes('data:image')
    ).length;

    const total = athletes.length;
    const status = withPhotos === total ? '✅' : '⚠️';

    console.log(`${status} ${teamName.padEnd(20)} ${withPhotos}/${total} headshots`);

    const missing = athletes.filter(a =>
      !a.photo_url || a.photo_url.includes('data:image')
    );

    if (missing.length > 0) {
      missing.forEach(m => console.log(`   - Missing: ${m.name}`));
    }
  }

  console.log('='.repeat(70));
}

main();
