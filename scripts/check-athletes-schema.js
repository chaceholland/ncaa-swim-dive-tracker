require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: sample } = await supabase
    .from('athletes')
    .select('*')
    .limit(1);
  
  if (sample && sample.length > 0) {
    console.log('Athletes table columns:');
    console.log(Object.keys(sample[0]));
  }
}

checkSchema();
