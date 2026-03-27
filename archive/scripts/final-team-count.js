require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFinal() {
  const { data: teams, count } = await supabase
    .from('teams')
    .select('*', { count: 'exact' })
    .gt('athlete_count', 0);
  
  console.log('='.repeat(70));
  console.log('FINAL TEAM STATUS');
  console.log('='.repeat(70));
  console.log(`Total teams with athletes: ${count}`);
  console.log('\nBy conference:');
  
  const byConf = {};
  teams.forEach(t => {
    byConf[t.conference] = (byConf[t.conference] || 0) + 1;
  });
  
  Object.entries(byConf).sort((a, b) => b[1] - a[1]).forEach(([conf, count]) => {
    console.log(`  ${conf.toUpperCase()}: ${count} teams`);
  });
  
  console.log('\nAll 11 SEC teams:');
  teams.filter(t => t.conference === 'sec').sort((a, b) => a.name.localeCompare(b.name)).forEach(t => {
    console.log(`  ✅ ${t.name} (${t.athlete_count} athletes)`);
  });
}

checkFinal();
