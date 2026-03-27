require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: teamRow } = await sb.from('teams').select('id').ilike('name', 'Utah').single();
  const { data: athletes } = await sb.from('athletes').select('*').eq('team_id', teamRow.id).in('name', ['Brody Lewis', 'McKay King']);
  console.log('Utah coaches in athletes table:');
  athletes.forEach(a => console.log(JSON.stringify(a, null, 2)));
}
main().catch(console.error);
