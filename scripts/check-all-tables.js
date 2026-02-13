require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  // Try to list tables by querying information_schema
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  if (error) {
    console.log('Cannot query information_schema, trying alternative...');
    
    // Try querying potential table names
    const potentialTables = ['athletes', 'teams', 'athlete_headshots', 'old_athletes', 'swimmers'];
    
    for (const table of potentialTables) {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✓ Table '${table}' exists with ${count} rows`);
      }
    }
  } else {
    console.log('Tables in public schema:', data);
  }
  
  // Check storage buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('\nStorage buckets:', buckets?.map(b => b.name));
}

checkTables();
