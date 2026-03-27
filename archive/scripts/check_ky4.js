require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: teamRow } = await sb.from('teams').select('id').ilike('name', 'Kentucky').single();
  const { data: athletes } = await sb.from('athletes').select('id, name, class_year').eq('team_id', teamRow.id).in('name', ['Cayden Pitzer', 'Levi Sandidge', 'Devin Naoroz', 'AJ Terry']);
  console.log('KY 4 athletes:', JSON.stringify(athletes, null, 2));
}
main().catch(console.error);
