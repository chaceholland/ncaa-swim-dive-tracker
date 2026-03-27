require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findAndFixAllPixelatedImages() {
  console.log('Scanning all athletes for pixelated images...\n');

  // Get all athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, photo_url, team_id');

  console.log(`Total athletes: ${athletes.length}`);

  // Patterns to check and fix
  const patterns = [
    { regex: /width=(\d+)&height=(\d+)/, minSize: 400 },
    { regex: /[?&]w=(\d+)/, minSize: 400 },
    { regex: /[?&]h=(\d+)/, minSize: 400 },
    { regex: /\/resize\/(\d+)x(\d+)\//, minSize: 400 },
  ];

  const toFix = [];
  const teamCounts = {};

  for (const athlete of athletes) {
    if (!athlete.photo_url) continue;

    let needsFix = false;
    let currentSize = null;

    // Check width=X&height=Y pattern
    const whMatch = athlete.photo_url.match(/width=(\d+)&height=(\d+)/);
    if (whMatch) {
      const width = parseInt(whMatch[1]);
      const height = parseInt(whMatch[2]);
      if (width < 400 || height < 400) {
        needsFix = true;
        currentSize = `${width}x${height}`;
      }
    }

    // Check w= pattern
    const wMatch = athlete.photo_url.match(/[?&]w=(\d+)/);
    if (wMatch && parseInt(wMatch[1]) < 400) {
      needsFix = true;
      currentSize = `w=${wMatch[1]}`;
    }

    if (needsFix) {
      // Get team name
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', athlete.team_id)
        .single();

      toFix.push({
        id: athlete.id,
        name: athlete.name,
        teamName: team.name,
        photo_url: athlete.photo_url,
        currentSize,
      });

      teamCounts[team.name] = (teamCounts[team.name] || 0) + 1;
    }
  }

  console.log(`\nFound ${toFix.length} pixelated images\n`);

  if (toFix.length === 0) {
    console.log('✅ All images are high quality!');
    return;
  }

  // Show teams affected
  console.log('Teams affected:');
  Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, count]) => {
      console.log(`  ${team}: ${count} athletes`);
    });

  console.log('\nFixing images...\n');

  let fixed = 0;
  for (const athlete of toFix) {
    let newUrl = athlete.photo_url;

    // Replace width/height parameters
    if (newUrl.includes('width=') && newUrl.includes('height=')) {
      newUrl = newUrl.replace(/width=\d+/, 'width=800');
      newUrl = newUrl.replace(/height=\d+/, 'height=800');
    }

    // Replace w= parameter
    if (newUrl.includes('?w=') || newUrl.includes('&w=')) {
      newUrl = newUrl.replace(/([?&])w=\d+/, '$1w=800');
    }

    // Replace h= parameter
    if (newUrl.includes('?h=') || newUrl.includes('&h=')) {
      newUrl = newUrl.replace(/([?&])h=\d+/, '$1h=800');
    }

    // Add cache buster if Sidearm URL
    if (newUrl.includes('sidearmdev.com') || newUrl.includes('sidearm')) {
      const separator = newUrl.includes('?') ? '&' : '?';
      newUrl = `${newUrl}${separator}v=${Date.now()}`;
    }

    const { error } = await supabase
      .from('athletes')
      .update({ photo_url: newUrl })
      .eq('id', athlete.id);

    if (!error) {
      fixed++;
      if (fixed % 25 === 0) {
        console.log(`  Fixed ${fixed}/${toFix.length}...`);
      }
    }
  }

  console.log(`\n✅ Fixed ${fixed} pixelated images!`);
  console.log('\nSample fixes:');
  toFix.slice(0, 5).forEach(a => {
    console.log(`  ${a.name} (${a.teamName}): ${a.currentSize} → 800x800`);
  });
}

findAndFixAllPixelatedImages();
