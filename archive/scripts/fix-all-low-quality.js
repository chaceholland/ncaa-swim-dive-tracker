require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function upgradeQuality(photoUrl) {
  if (!photoUrl || photoUrl.includes('/logos/')) {
    return { upgraded: photoUrl, changed: false };
  }

  // Skip supabase-hosted images (need manual scraping)
  if (photoUrl.includes('supabase.co/storage')) {
    return { upgraded: photoUrl, changed: false };
  }

  // Upgrade any image with width parameter
  if (photoUrl.includes('width=')) {
    try {
      const url = new URL(photoUrl);
      const currentWidth = url.searchParams.get('width');

      if (currentWidth && parseInt(currentWidth) < 1920) {
        url.searchParams.set('width', '1920');
        url.searchParams.set('height', '1920');
        return {
          upgraded: url.toString(),
          changed: true,
          from: parseInt(currentWidth)
        };
      }
    } catch (error) {
      return { upgraded: photoUrl, changed: false };
    }
  }

  // Upgrade crop URLs
  if (photoUrl.includes('crop') || photoUrl.includes('resize')) {
    try {
      const url = new URL(photoUrl);
      const hasWidth = url.searchParams.has('width');
      const hasHeight = url.searchParams.has('height');

      if (hasWidth || hasHeight) {
        const currentWidth = url.searchParams.get('width') || '0';
        if (parseInt(currentWidth) < 1920) {
          url.searchParams.set('width', '1920');
          url.searchParams.set('height', '1920');
          return {
            upgraded: url.toString(),
            changed: true,
            from: parseInt(currentWidth)
          };
        }
      }
    } catch (error) {
      return { upgraded: photoUrl, changed: false };
    }
  }

  return { upgraded: photoUrl, changed: false };
}

async function fixTeam(team) {
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url')
    .eq('team_id', team.id)
    .order('name');

  let updated = 0;
  const upgrades = [];

  for (const athlete of athletes) {
    const result = upgradeQuality(athlete.photo_url);

    if (result.changed) {
      await supabase
        .from('athletes')
        .update({ photo_url: result.upgraded })
        .eq('id', athlete.id);

      upgrades.push({
        name: athlete.name,
        from: result.from
      });

      updated++;
    }
  }

  return { updated, upgrades, total: athletes.length };
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('UPGRADING ALL LOW-QUALITY IMAGES TO 1920x1920');
  console.log('='.repeat(80) + '\n');

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .order('name');

  let totalUpdated = 0;
  let totalAthletes = 0;

  for (const team of teams) {
    const result = await fixTeam(team);
    totalAthletes += result.total;

    if (result.updated > 0) {
      console.log(`\n${team.name}: ${result.updated}/${result.total} upgraded`);

      // Show sample upgrades
      result.upgrades.slice(0, 3).forEach(u => {
        console.log(`  - ${u.name}: ${u.from}x${u.from} → 1920x1920`);
      });

      if (result.upgrades.length > 3) {
        console.log(`  ... and ${result.upgrades.length - 3} more`);
      }

      totalUpdated += result.updated;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('UPGRADE COMPLETE');
  console.log('='.repeat(80));
  console.log(`Total athletes: ${totalAthletes}`);
  console.log(`Upgraded: ${totalUpdated}`);
  console.log(`Remaining low quality: Supabase-hosted images (need scraping)`);
  console.log('='.repeat(80) + '\n');
}

main();
