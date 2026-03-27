require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const toDelete = [
  { team: 'Penn State', names: ['Ethan Curl', 'Sean Schimmel'] },
  { team: 'Arizona State', names: ['Alex Sherman'] },
  { team: 'TCU', names: ['Anthony Crowder', 'James Winchester'] },
  { team: 'Army', names: ['Connor Dorff'] },
  { team: 'Southern Illinois', names: ['Tiago Faleiros', 'Tomáš Peciar'] },
  { team: 'North Carolina', names: ['Tom Mienis'] },
];

async function main() {
  let totalDeleted = 0;
  for (const { team, names } of toDelete) {
    const { data: t } = await supabase.from('teams').select('id').eq('name', team).single();
    if (!t) { console.log('Team not found: ' + team); continue; }
    const { data: athletes } = await supabase.from('athletes').select('id, name').eq('team_id', t.id).in('name', names);
    if (!athletes || athletes.length === 0) { console.log(team + ': none found'); continue; }
    const ids = athletes.map(a => a.id);
    const { error } = await supabase.from('athletes').delete().in('id', ids);
    if (error) {
      console.log(team + ' error: ' + error.message);
    } else {
      athletes.forEach(a => console.log('Deleted: ' + a.name + ' (' + team + ')'));
      totalDeleted += athletes.length;
    }
  }
  console.log('\nTotal deleted: ' + totalDeleted);
}
main().catch(console.error);
