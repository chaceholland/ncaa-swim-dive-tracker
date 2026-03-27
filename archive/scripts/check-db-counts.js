const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: teams } = await supabase.from('teams').select('id, name');
  const teamMap = new Map(teams.map(t => [t.id, t.name]));
  
  const { data: athletes } = await supabase.from('athletes').select('team_id, is_archived');
  
  const counts = {};
  athletes.forEach(a => {
    const name = teamMap.get(a.team_id) || 'Unknown';
    if (counts[name] === undefined) counts[name] = { total: 0, archived: 0 };
    counts[name].total++;
    if (a.is_archived) counts[name].archived++;
  });
  
  const sorted = Object.entries(counts).sort((a, b) => b[1].total - a[1].total);
  sorted.forEach(([name, c]) => console.log(name + ': ' + c.total + ' (archived: ' + c.archived + ')'));
  console.log('\nTeams with no athletes:', teams.filter(t => !counts[t.name]).map(t => t.name).join(', '));
}
main();
