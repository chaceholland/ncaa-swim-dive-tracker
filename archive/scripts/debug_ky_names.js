require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normName(n) { return (n || '').toLowerCase().replace(/[^a-z]/g, ''); }
function lastName(n) {
  const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
  const parts = (n || '').trim().split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].toLowerCase().replace(/[^a-z]/g, '');
    if (!suffixes.has(p) && p.length > 0) return p;
  }
  return normName(parts[parts.length - 1] || '');
}

async function main() {
  const { data: teamRow } = await sb.from('teams').select('id').ilike('name', 'Kentucky').single();
  const { data: dbAthletes } = await sb.from('athletes').select('id, name').eq('team_id', teamRow.id).is('class_year', null);
  
  console.log('DB athletes missing class_year:');
  dbAthletes.forEach(a => console.log(`  norm: "${normName(a.name)}" | last: "${lastName(a.name)}" | name: "${a.name}"`));
  
  // Scraped from website
  const scraped = [
    { name: 'Devin Naoroz', classYear: 'Junior' },
    { name: 'Cayden Pitzer', classYear: 'Junior' },
    { name: 'Levi Sandidge', classYear: 'Senior' },
    { name: 'AJ Terry', classYear: 'Junior' },
  ];
  
  console.log('\nScraped athletes:');
  scraped.forEach(a => {
    const sNorm = normName(a.name);
    const sLast = lastName(a.name);
    const exact = dbAthletes.find(d => normName(d.name) === sNorm);
    const lastMatch = dbAthletes.filter(d => lastName(d.name) === sLast);
    console.log(`  "${a.name}" | sNorm: "${sNorm}" | sLast: "${sLast}" | exact: ${exact ? exact.name : 'null'} | lastMatches: ${lastMatch.length}`);
  });
}
main().catch(console.error);
