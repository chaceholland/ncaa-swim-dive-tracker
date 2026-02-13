require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  // List folders in athlete-headshots bucket
  const { data: folders, error } = await supabase.storage
    .from('athlete-headshots')
    .list('', { limit: 100 });
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log(`Found ${folders.length} folders/files in athlete-headshots bucket:\n`);
  
  // Show folders (team names)
  const teamFolders = folders.filter(f => !f.name.includes('.'));
  console.log('Team folders:', teamFolders.map(f => f.name).join(', '));
  console.log(`\nTotal team folders: ${teamFolders.length}`);
  
  // Check Auburn folder
  const { data: auburnFiles } = await supabase.storage
    .from('athlete-headshots')
    .list('auburn', { limit: 100 });
  
  console.log(`\nAuburn folder has ${auburnFiles.length} photos`);
  if (auburnFiles.length > 0) {
    console.log('Sample Auburn files:');
    auburnFiles.slice(0, 5).forEach(f => console.log(`  - ${f.name}`));
  }
}

checkStorage();
