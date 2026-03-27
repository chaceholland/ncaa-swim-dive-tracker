require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const updates = [
  { id: 'c5ed7658-002b-4181-949a-da2aea7f6026', name: 'Cayden Pitzer', class_year: 'junior' },
  { id: '2277924d-8f59-4da1-94cb-21d086ca812f', name: 'Levi Sandidge', class_year: 'senior' },
  { id: 'af9151ef-2b5e-41f1-a451-e416b14099c3', name: 'Devin Naoroz', class_year: 'junior' },
  { id: 'a657b739-d763-4d62-b6b1-31ecb2db221b', name: 'AJ Terry', class_year: 'junior' },
];

async function main() {
  for (const u of updates) {
    const { error } = await sb.from('athletes').update({ class_year: u.class_year }).eq('id', u.id).is('class_year', null);
    if (error) {
      console.log(`${u.name}: ERROR - ${error.message}`);
    } else {
      console.log(`${u.name}: OK → "${u.class_year}"`);
    }
  }
  // Verify
  const ids = updates.map(u => u.id);
  const { data } = await sb.from('athletes').select('name, class_year').in('id', ids);
  console.log('\nVerification:');
  data.forEach(a => console.log(`  ${a.name}: ${a.class_year}`));
}
main().catch(console.error);
