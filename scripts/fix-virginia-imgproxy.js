require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function decodeImgproxyUrl(imgproxyUrl) {
  const match = imgproxyUrl.match(/\/([^\/]+)\.(jpg|png)$/);
  if (!match) return null;

  try {
    const base64Url = match[1];
    const originalUrl = Buffer.from(base64Url, 'base64').toString('utf-8');
    
    if (originalUrl.includes('storage.googleapis.com')) {
      return originalUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function fixTeam(teamName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FIXING: ${teamName}`);
  console.log('='.repeat(70));

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  if (!team) {
    console.log(`❌ ${teamName} not found`);
    return;
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .like('photo_url', '%imgproxy%')
    .order('name');

  console.log(`\nFound ${athletes.length} athletes with imgproxy URLs\n`);

  let updated = 0;
  for (const athlete of athletes) {
    console.log(`  Processing: ${athlete.name}`);
    
    const decodedUrl = decodeImgproxyUrl(athlete.photo_url);
    
    if (decodedUrl) {
      await supabase
        .from('athletes')
        .update({ photo_url: decodedUrl })
        .eq('id', athlete.id);
      
      console.log(`    ✅ Decoded`);
      updated++;
    } else {
      console.log(`    ❌ Failed to decode`);
    }
  }

  console.log(`\n✅ ${teamName}: ${updated}/${athletes.length} decoded\n`);
}

async function main() {
  await fixTeam('Virginia');
  await fixTeam('Virginia Tech');
}

main();
