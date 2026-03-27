require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  for (const teamName of ['Purdue', 'Ohio State']) {
    const { data: team } = await supabase
      .from('teams')
      .select('id, logo_url')
      .eq('name', teamName)
      .single();

    const { data: athletes } = await supabase
      .from('athletes')
      .select('name, photo_url')
      .eq('team_id', team.id)
      .limit(3);

    console.log(`\n${teamName}:`);
    athletes.forEach(a => {
      const isLogo = a.photo_url === team.logo_url;
      console.log(`  ${a.name}: ${isLogo ? '[LOGO]' : a.photo_url}`);
    });
  }
}

main();
