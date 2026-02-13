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

  // Upgrade sidearmdev crop URLs from any size to 1920x1920
  if (photoUrl.includes('images.sidearmdev.com/crop')) {
    try {
      const url = new URL(photoUrl);
      const currentWidth = url.searchParams.get('width');
      const currentHeight = url.searchParams.get('height');

      // Only upgrade if currently low resolution
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

async function fixTeam(teamName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`CHECKING: ${teamName}`);
  console.log('='.repeat(70));

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .single();

  const { data: dbAthletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  console.log(`\nTotal athletes: ${dbAthletes.length}`);

  let updated = 0;
  const upgradeable = [];

  // Check each athlete's photo URL
  for (const athlete of dbAthletes) {
    const upgraded = upgradeQuality(athlete.photo_url);
    if (upgraded !== athlete.photo_url) {
      upgradeable.push({ athlete, upgraded });
    }
  }

  console.log(`Can upgrade: ${upgradeable.length}`);

  if (upgradeable.length === 0) {
    console.log('✅ No upgrades needed');
    return;
  }

  console.log('\nUpgrading...');
  for (const { athlete, upgraded } of upgradeable) {
    // Show before/after for first few
    if (updated < 3) {
      console.log(`\n${athlete.name}:`);

      const beforeMatch = athlete.photo_url.match(/width=(\d+)/);
      const afterMatch = upgraded.match(/width=(\d+)/);

      if (beforeMatch && afterMatch) {
        console.log(`  ${beforeMatch[1]}x${beforeMatch[1]} → ${afterMatch[1]}x${afterMatch[1]}`);
      }
    }

    await supabase
      .from('athletes')
      .update({ photo_url: upgraded })
      .eq('id', athlete.id);

    updated++;
  }

  console.log(`\n✅ ${teamName}: ${updated} athletes upgraded to high resolution`);
}

async function main() {
  console.log('\n🔧 FIXING ACC PIXELATED IMAGES');
  console.log('Upgrading all low-resolution images to 1920x1920...\n');

  const teams = ['NC State', 'Pittsburgh', 'North Carolina', 'Duke'];

  for (const team of teams) {
    await fixTeam(team);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ ACC QUALITY UPGRADE COMPLETE');
  console.log('='.repeat(70));
}

main();
