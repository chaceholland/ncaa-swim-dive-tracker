require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: athletes, error } = await sb.from('athletes').select('id, name, class_year').eq('team_id', '9ded9ee7-142a-4ecf-bf7a-fe17b84b26fa');
  if (error) { console.error(error.message); return; }
  console.log('All UNLV athletes in DB:', athletes.length);
  athletes.forEach(a => console.log(`  ${a.name} | class_year: ${a.class_year}`));
}
main().catch(console.error);
