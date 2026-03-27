require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔍 FINDING: Teams with Supabase Uploads vs Team Logos\n');

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .order('name');

  const results = [];

  for (const team of teams) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id);

    if (!athletes || athletes.length === 0) continue;

    const stats = {
      total: athletes.length,
      supabaseUploads: 0,
      teamLogos: 0,
      highQuality: 0,
      other: 0
    };

    athletes.forEach(athlete => {
      if (!athlete.photo_url || athlete.photo_url === team.logo_url || athlete.photo_url.includes('/logos/')) {
        stats.teamLogos++;
      } else if (athlete.photo_url.includes('supabase.co/storage')) {
        stats.supabaseUploads++;
      } else if (athlete.photo_url.includes('width=1920') || athlete.photo_url.includes('width=1600')) {
        stats.highQuality++;
      } else {
        stats.other++;
      }
    });

    results.push({
      name: team.name,
      ...stats
    });
  }

  // Sort by teams with most Supabase uploads
  results.sort((a, b) => b.supabaseUploads - a.supabaseUploads);

  console.log('Teams with Supabase uploads (pixelated individual photos):\n');

  const teamsWithSupabase = results.filter(r => r.supabaseUploads > 0);

  if (teamsWithSupabase.length === 0) {
    console.log('No teams found with Supabase uploads');
  } else {
    teamsWithSupabase.forEach(team => {
      const pct = ((team.supabaseUploads / team.total) * 100).toFixed(0);
      console.log(`${team.name}:`);
      console.log(`  Total: ${team.total} athletes`);
      console.log(`  Supabase uploads: ${team.supabaseUploads} (${pct}%)`);
      console.log(`  Team logos: ${team.teamLogos}`);
      console.log(`  High quality: ${team.highQuality}`);
      if (team.other > 0) console.log(`  Other: ${team.other}`);
      console.log('');
    });
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total teams: ${results.length}`);
  console.log(`Teams with Supabase uploads: ${teamsWithSupabase.length}`);
  console.log(`Teams using only team logos: ${results.filter(r => r.supabaseUploads === 0 && r.teamLogos === r.total).length}`);
}

main();
