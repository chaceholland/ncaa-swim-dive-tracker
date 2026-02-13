require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlaceholders() {
  const teams = ['Tennessee', 'Auburn'];

  for (const teamName of teams) {
    const { data: team } = await supabase
      .from('teams')
      .select('id, logo_url')
      .eq('name', teamName)
      .single();

    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id)
      .order('name');

    console.log(`\n${teamName} (${athletes.length} athletes):`);
    console.log('='.repeat(60));

    athletes.forEach(a => {
      const isPlaceholder = a.photo_url && (
        a.photo_url.includes('placeholder') ||
        a.photo_url.includes('default') ||
        a.photo_url.includes('person-default')
      );

      const isLogo = a.photo_url && a.photo_url === team.logo_url;
      const noPhoto = !a.photo_url;

      let status = '✅ Has photo';
      if (noPhoto) status = '❌ No photo';
      else if (isPlaceholder) status = '⚠️  Placeholder';
      else if (isLogo) status = '📋 Team logo';

      console.log(`  ${a.name.padEnd(30)} ${status}`);
    });
  }
}

checkPlaceholders();
