require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const badMatches = [
  { team: 'Florida State', name: 'Aidan Siers' },
  { team: 'Arizona State', name: 'Caleb Liban' },
  { team: 'Columbia', name: 'Derrick Butts' },
  { team: 'Alabama', name: 'Paul Mathews' },
  { team: 'Alabama', name: 'Peter Edin' },
];

async function main() {
  for (const { team, name } of badMatches) {
    const { data: t } = await supabase.from('teams').select('id, logo_url').eq('name', team).single();
    if (!t) continue;
    const { error } = await supabase.from('athletes')
      .update({ profile_url: null, photo_url: t.logo_url })
      .eq('team_id', t.id).eq('name', name);
    if (error) console.log(`Error reverting ${name}: ${error.message}`);
    else console.log(`Reverted: ${name} (${team}) → logo`);
  }
}
main().catch(console.error);
