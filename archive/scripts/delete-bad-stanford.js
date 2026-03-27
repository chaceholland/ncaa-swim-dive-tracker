require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data: t } = await supabase.from('teams').select('id').eq('name', 'Stanford').single();
  const { error } = await supabase.from('athletes').delete()
    .eq('team_id', t.id).eq('name', 'Roster for Basketball');
  if (error) console.log('Error:', error.message);
  else console.log('Deleted bad entry: "Roster for Basketball" from Stanford');
}
main().catch(console.error);
