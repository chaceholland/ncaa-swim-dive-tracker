require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .limit(1);

  if (data && data.length > 0) {
    console.log('Current athletes table columns:');
    console.log(Object.keys(data[0]).join(', '));
  } else if (error) {
    console.log('Error:', error.message);
  }
}

checkSchema();
