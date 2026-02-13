require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumns() {
  console.log('Adding missing columns to athletes table...\n');

  const queries = [
    'ALTER TABLE athletes ADD COLUMN IF NOT EXISTS height TEXT',
    'ALTER TABLE athletes ADD COLUMN IF NOT EXISTS weight TEXT',
    'ALTER TABLE athletes ADD COLUMN IF NOT EXISTS high_school TEXT',
  ];

  for (const query of queries) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: query });
    if (error) {
      console.log(`Error: ${error.message}`);
      console.log('Trying direct SQL execution...');
      
      // Try using the SQL editor endpoint
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        console.log(`Failed: ${query}`);
      } else {
        console.log(`✅ ${query}`);
      }
    } else {
      console.log(`✅ ${query}`);
    }
  }
}

addColumns();
