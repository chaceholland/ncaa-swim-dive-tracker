require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { count: totalMissing } = await sb.from('athletes').select('id', { count: 'exact', head: true }).is('class_year', null);
  console.log('Total athletes still missing class_year:', totalMissing);
  
  // Get breakdown by team
  const { data: missing } = await sb.from('athletes').select('team_id').is('class_year', null);
  const teamCounts = {};
  missing.forEach(a => { teamCounts[a.team_id] = (teamCounts[a.team_id] || 0) + 1; });
  
  // Get team names
  for (const [tid, cnt] of Object.entries(teamCounts)) {
    const { data: t } = await sb.from('teams').select('name').eq('id', tid).single();
    console.log(`  ${t ? t.name : tid}: ${cnt}`);
  }
}
main().catch(console.error);
