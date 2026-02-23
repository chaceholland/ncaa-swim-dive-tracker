require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BROKEN_PATTERNS = ['ad_counter', 'thenameengine', 'securepubads'];

function isBroken(url) {
  if (!url) return true;
  if (url.endsWith('/roster') || url.endsWith('/roster/')) return true;
  return BROKEN_PATTERNS.some(p => url.includes(p));
}

async function main() {
  const { data: team } = await supabase.from('teams').select('id').eq('name', 'Harvard').single();
  const { data: athletes } = await supabase.from('athletes').select('name, photo_url, profile_url').eq('team_id', team.id).order('name');
  athletes.forEach(a => {
    const status = isBroken(a.photo_url) ? '❌' : '✅';
    console.log(status, a.name, '|', (a.photo_url || 'null').substring(0, 70));
  });
  const broken = athletes.filter(a => isBroken(a.photo_url));
  console.log(`\nBroken: ${broken.length}/${athletes.length}`);
}
main();
