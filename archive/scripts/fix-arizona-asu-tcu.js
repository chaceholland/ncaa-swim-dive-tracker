require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function decodeImgproxyUrl(imgproxyUrl) {
  const match = imgproxyUrl.match(/\/([^\/]+)\.(jpg|png|webp)$/);
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

function upgradePhotoQuality(photoUrl) {
  if (!photoUrl) return null;

  try {
    const url = new URL(photoUrl);
    
    // Arizona: CloudFront with width/quality params
    if (photoUrl.includes('cloudfront.net') && url.searchParams.has('width')) {
      url.searchParams.set('width', '1200');
      url.searchParams.set('quality', '95');
      return url.toString();
    }
    
    // TCU: sidearmdev crop URLs
    if (photoUrl.includes('images.sidearmdev.com/crop')) {
      url.searchParams.set('width', '1920');
      url.searchParams.set('height', '1920');
      return url.toString();
    }
    
    return photoUrl;
  } catch (error) {
    return photoUrl;
  }
}

async function fixArizonaState() {
  console.log('\n' + '='.repeat(70));
  console.log('FIXING: Arizona State (Imgproxy Decoding)');
  console.log('='.repeat(70));

  const {data:team} = await supabase.from('teams').select('id').eq('name','Arizona State').single();
  const {data:athletes} = await supabase.from('athletes').select('id,name,photo_url').eq('team_id',team.id).like('photo_url','%imgproxy%');

  console.log(`\nFound ${athletes.length} athletes with imgproxy URLs\n`);

  let updated = 0;
  for (const athlete of athletes) {
    console.log(`  ${athlete.name}`);
    const decoded = decodeImgproxyUrl(athlete.photo_url);
    
    if (decoded) {
      await supabase.from('athletes').update({photo_url:decoded}).eq('id',athlete.id);
      console.log(`    ✅ Decoded`);
      updated++;
    } else {
      console.log(`    ❌ Failed`);
    }
  }

  console.log(`\n✅ Arizona State: ${updated}/${athletes.length} decoded\n`);
}

async function fixArizona() {
  console.log('\n' + '='.repeat(70));
  console.log('FIXING: Arizona (Quality Upgrade)');
  console.log('='.repeat(70));

  const {data:team} = await supabase.from('teams').select('id').eq('name','Arizona').single();
  const {data:athletes} = await supabase.from('athletes').select('id,name,photo_url').eq('team_id',team.id).not('photo_url','is',null);

  console.log(`\nFound ${athletes.length} athletes\n`);

  let updated = 0;
  for (const athlete of athletes) {
    const upgraded = upgradePhotoQuality(athlete.photo_url);
    
    if (upgraded !== athlete.photo_url) {
      console.log(`  ${athlete.name}`);
      await supabase.from('athletes').update({photo_url:upgraded}).eq('id',athlete.id);
      console.log(`    ✅ Upgraded to 1200x95`);
      updated++;
    }
  }

  console.log(`\n✅ Arizona: ${updated}/${athletes.length} upgraded\n`);
}

async function fixTCU() {
  console.log('\n' + '='.repeat(70));
  console.log('FIXING: TCU (Quality Upgrade)');
  console.log('='.repeat(70));

  const {data:team} = await supabase.from('teams').select('id').eq('name','TCU').single();
  const {data:athletes} = await supabase.from('athletes').select('id,name,photo_url').eq('team_id',team.id).not('photo_url','is',null);

  console.log(`\nFound ${athletes.length} athletes\n`);

  let updated = 0;
  for (const athlete of athletes) {
    const upgraded = upgradePhotoQuality(athlete.photo_url);
    
    if (upgraded !== athlete.photo_url) {
      console.log(`  ${athlete.name}`);
      await supabase.from('athletes').update({photo_url:upgraded}).eq('id',athlete.id);
      console.log(`    ✅ Upgraded to 1920x1920`);
      updated++;
    }
  }

  console.log(`\n✅ TCU: ${updated}/${athletes.length} upgraded\n`);
}

async function main() {
  await fixArizonaState();
  await fixArizona();
  await fixTCU();
}

main();
