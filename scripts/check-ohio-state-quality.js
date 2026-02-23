require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n🔍 CHECKING: Ohio State Headshot Quality\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id, logo_url')
    .eq('name', 'Ohio State')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Total athletes: ${athletes.length}\n`);

  const issues = {
    lowQuality: [],
    teamLogo: [],
    highQuality: [],
    supabaseUploads: []
  };

  athletes.forEach(athlete => {
    if (!athlete.photo_url || athlete.photo_url === team.logo_url) {
      issues.teamLogo.push(athlete);
    } else if (athlete.photo_url.includes('supabase.co/storage')) {
      issues.supabaseUploads.push(athlete);
    } else if (athlete.photo_url.includes('width=1920') || athlete.photo_url.includes('width=1600')) {
      issues.highQuality.push(athlete);
    } else {
      issues.lowQuality.push(athlete);
    }
  });

  console.log('Quality Breakdown:');
  console.log(`  High quality (1600-1920px): ${issues.highQuality.length}`);
  console.log(`  Low quality (needs upgrade): ${issues.lowQuality.length}`);
  console.log(`  Supabase uploads: ${issues.supabaseUploads.length}`);
  console.log(`  Team logos: ${issues.teamLogo.length}`);

  if (issues.lowQuality.length > 0) {
    console.log(`\nLow quality images (${issues.lowQuality.length}):`);
    issues.lowQuality.forEach(a => {
      const url = a.photo_url || '';
      const widthMatch = url.match(/width=(\d+)/);
      const currentWidth = widthMatch ? widthMatch[1] : 'unknown';
      console.log(`  ${a.name}: ${currentWidth}px - ${url.substring(0, 80)}...`);
    });
  }

  if (issues.supabaseUploads.length > 0) {
    console.log(`\nSupabase uploads (${issues.supabaseUploads.length}):`);
    issues.supabaseUploads.forEach(a => {
      console.log(`  ${a.name}: ${a.photo_url.substring(0, 80)}...`);
    });
  }
}

main();
