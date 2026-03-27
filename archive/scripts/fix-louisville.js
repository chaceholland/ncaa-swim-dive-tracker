require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function upgradeQuality(photoUrl) {
  if (!photoUrl || photoUrl.includes('/logos/')) {
    return photoUrl;
  }

  // Upgrade sidearmdev crop URLs
  if (photoUrl.includes('images.sidearmdev.com/crop')) {
    try {
      const url = new URL(photoUrl);
      const currentWidth = url.searchParams.get('width');
      const currentHeight = url.searchParams.get('height');

      if (parseInt(currentWidth) < 1920 || parseInt(currentHeight) < 1920) {
        url.searchParams.set('width', '1920');
        url.searchParams.set('height', '1920');
        return url.toString();
      }
    } catch (error) {
      return photoUrl;
    }
  }

  // Upgrade CloudFront URLs with width parameters
  if (photoUrl.includes('cloudfront.net') && photoUrl.includes('?width=')) {
    try {
      const url = new URL(photoUrl);
      const currentWidth = url.searchParams.get('width');
      if (currentWidth && parseInt(currentWidth) < 1200) {
        url.searchParams.set('width', '1200');
        return url.toString();
      }
    } catch (error) {
      return photoUrl;
    }
  }

  return photoUrl;
}

async function main() {
  console.log('\n🔧 FIXING LOUISVILLE PIXELATED IMAGES\n');

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Louisville')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Total athletes: ${athletes.length}\n`);

  let updated = 0;

  for (const athlete of athletes) {
    const upgraded = upgradeQuality(athlete.photo_url);

    if (upgraded !== athlete.photo_url) {
      const beforeMatch = athlete.photo_url.match(/width=(\d+)/);
      const afterMatch = upgraded.match(/width=(\d+)/);

      console.log(`${athlete.name}:`);
      if (beforeMatch && afterMatch) {
        console.log(`  ${beforeMatch[1]}x${beforeMatch[1]} → ${afterMatch[1]}x${afterMatch[1]}`);
      }

      await supabase
        .from('athletes')
        .update({ photo_url: upgraded })
        .eq('id', athlete.id);

      updated++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ LOUISVILLE: ${updated} athletes upgraded to high resolution`);
  console.log('='.repeat(70));
}

main();
