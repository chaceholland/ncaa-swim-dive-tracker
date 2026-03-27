require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const teams = ['Kentucky', 'Utah', 'UNLV'];
  for (const t of teams) {
    const { data: teamRow } = await sb.from('teams').select('id').ilike('name', t).single();
    if (!teamRow) { console.log(t, ': team not found'); continue; }
    const { data: athletes } = await sb.from('athletes').select('id, name').eq('team_id', teamRow.id).is('class_year', null);
    console.log(`\n${t} (${athletes.length} missing):`);
    athletes.forEach(a => console.log(' ', a.name));
  }
}
main().catch(console.error);
